import { describe, expect, it } from "vitest";
import { setup } from "./game-setup";
import { api, internal } from "../convex/_generated/api";

describe("Stockmarket transactions", () =>
{
    it("keeps private insights private and rejects nonmembers and unauthenticated callers", async () =>
    {
        const { t, sam, bob, outsider } = await setup();

        await expect(bob.mutation(api.games.start, { code: "test" })).rejects.toThrow("Only the lobby host");
        await sam.mutation(api.games.start, { code: "test" });
        const board = await bob.query(api.board.get, { code: "test" });

        expect(board.insights).toHaveLength(10);
        expect(board.insights.every((insight) => insight.playerId === board.player._id)).toBe(true);
        await expect(outsider.query(api.board.get, { code: "test" })).rejects.toThrow("Join this game first");
        await expect(t.query(api.board.get, { code: "test" })).rejects.toThrow("Please log in");
        await expect(outsider.mutation(api.games.join, { code: "test" })).rejects.toThrow("already started");
    });
    it("buys and sells permitted quantities, rotates turns and rejects invalid trades without changing state", async () =>
    {
        const { sam, bob, pat, lee } = await setup();

        await sam.mutation(api.games.start, { code: "test" });
        await expect(bob.mutation(api.trading.play, { code: "test", expectedTurn: 0, expectedPeriod: 0 })).rejects.toThrow("not your turn");

        for (const quantity of [1, 1.5, 6500, 15_001, -6500, -15_001, 1_000_000, 25_000, -1000, 0])
        {
            await expect(sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, expectedPeriod: 0, stockKey: 8, quantity })).rejects.toThrow();
        }

        await sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, expectedPeriod: 0, stockKey: 8, quantity: 1000 });
        let board = await sam.query(api.board.get, { code: "test" });

        expect(board.player.cash).toBe(57_500);
        expect(board.player.holdings.find((holding) => holding.stockKey === 8)?.quantity).toBe(1000);
        expect(board.game.turn).toBe(1);
        expect(board.feed[0].message).toBe("bought 1000 shares in UB");
        expect(board.feed[0]).toMatchObject({ stockKey: 8, quantity: 1000 });
        await bob.mutation(api.trading.play, { code: "test", expectedTurn: 1, expectedPeriod: 0 });
        await pat.mutation(api.trading.play, { code: "test", expectedTurn: 2, expectedPeriod: 0 });
        await lee.mutation(api.trading.play, { code: "test", expectedTurn: 3, expectedPeriod: 0 });
        await sam.mutation(api.trading.play, { code: "test", expectedTurn: 4, expectedPeriod: 0, stockKey: 8, quantity: -1000 });
        board = await sam.query(api.board.get, { code: "test" });
        expect(board.feed[0]).toMatchObject({ stockKey: 8, quantity: -1000 });
        expect(board.player.cash).toBe(60_000);
        expect(board.player.holdings.find((holding) => holding.stockKey === 8)?.quantity).toBe(0);
    });
    it("closes after three actions each, settles all insights exactly once, then redeals or finishes", async () =>
    {
        const { sam, bob, clients } = await setup(5);

        await sam.mutation(api.games.start, { code: "test" });

        for (let turn = 0; turn < 12; turn++)
        {
            await clients[turn % 4].mutation(api.trading.play, { code: "test", expectedTurn: turn, expectedPeriod: 0 });
        }

        const closed = await sam.query(api.board.get, { code: "test" });

        expect(closed.game.status).toBe("closed");
        expect(closed.insights).toHaveLength(40);
        await sam.mutation(api.rounds.showSpecial, { code: "test" });
        expect((await bob.query(api.board.get, { code: "test" })).game.status).toBe("closed");
        await expect(bob.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 }))
            .rejects.toThrow("Only the lobby host");
        await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 });
        const next = await sam.query(api.board.get, { code: "test" });

        expect(next.game.status).toBe("playing");
        expect(next.game.currentPeriod).toBe(1);
        expect(next.insights).toHaveLength(10);

        for (const price of next.game.prices)
        {
            const old = closed.game.prices.find((item) => item.stockKey === price.stockKey)?.value ?? 0;
            const delta = closed.insights.filter((insight) => insight.stockKey === price.stockKey)
                .reduce((sum, insight) => sum + insight.value, 0);

            expect(price.value).toBe(Math.max(0, old + delta));
        }

        await expect(sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 })).rejects.toThrow();

        for (let period = 1; period < 6; period++)
        {
            for (let turn = 0; turn < 12; turn++)
            {
                const client = clients[(turn + period) % 4];

                await client.mutation(api.trading.play, { code: "test", expectedTurn: turn, expectedPeriod: period });
            }

            await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: period });
        }

        expect((await bob.query(api.board.get, { code: "test" })).game.status).toBe("finished");
    });
    it("rejects duplicate requests and overcapacity lobbies", async () =>
    {
        const { t, sam } = await setup();
        for (let index = 0; index < 2; index++)
        {
            const userId = await t.run(async (context) => await context.db.insert("users", {
                name: `player${index}`, profileRoot: "/static/imgs/1profile.png",
            }));

            await t.withIdentity({ subject: `${userId}|session` }).mutation(api.games.join, { code: "test" });
        }

        const extraId = await t.run(async (context) => await context.db.insert("users", { name: "extra", profileRoot: "" }));

        await expect(t.withIdentity({ subject: `${extraId}|session` }).mutation(api.games.join, { code: "test" })).rejects.toThrow("full");
        await sam.mutation(api.games.start, { code: "test" });
        await sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, expectedPeriod: 0 });
        await expect(sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, expectedPeriod: 0 })).rejects.toThrow();
    });
    it("supports imported currency and hold-stock insights and prevents other players using them", async () =>
    {
        const { t, sam, bob } = await setup();

        await t.mutation(internal.catalogAdmin.importCatalog, {
            stocks: [
                { key: 13, name: "currency", startingValue: 0, imagePath: "", secondaryImagePath: "", variation: 0, display: false },
                { key: 14, name: "Hold Stock Price", startingValue: 0, imagePath: "", secondaryImagePath: "", variation: 0, display: false },
            ], insights: [],
        });
        await sam.mutation(api.games.start, { code: "test" });
        const board = await sam.query(api.board.get, { code: "test" });
        const insightId = await t.run(async (context) =>
        {
            await context.db.insert("playerInsights", { gameId: board.game._id, playerId: board.player._id, period: 0,
                stockKey: 13, description: "Currency test", value: 0.1, resolved: false });
            await context.db.patch(board.game._id, { status: "special_insights" });

            return await context.db.insert("playerInsights", { gameId: board.game._id, playerId: board.player._id, period: 0,
                stockKey: 14, description: "Hold test", value: 0, resolved: false });
        });

        await expect(bob.mutation(api.rounds.hold, { code: "test", insightId, stockKey: 8 })).rejects.toThrow();
        await expect(sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 })).rejects.toThrow("resolve");
        await expect(t.mutation(api.rounds.nextSpectator, { code: "test", expectedPeriod: 0 })).rejects.toThrow("resolve");
        await sam.mutation(api.rounds.hold, { code: "test", insightId, stockKey: 8 });
        await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 });
        const finished = await sam.query(api.board.get, { code: "test" });

        expect(finished.game.prices.find((price) => price.stockKey === 8)?.value).toBe(2.5);
        expect(finished.player.cash).toBe(66_000);
    });
});
