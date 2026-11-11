import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { chooseTechStart, techPrices } from "../../stockmarket-shared/src/engine/techMarket";
import { techRoundCount } from "../shared/packs";
import { setup } from "./game-setup";
import { buildNpcObservation } from "../convex/npc/observation";
import { estimate } from "../../stockmarket-shared/src/packages/npc-engine/src/estimate";

const code = "test";

describe("stock packs", () =>
{
    it("updates existing seats and restores their original market and game length when switching back", async () =>
    {
        const { t, sam, bob } = await setup(8);
        const classic = await sam.query(api.board.get, { code });

        await expect(bob.mutation(api.games.setPack, { code, pack: "tech" })).rejects.toThrow("Only the lobby host");
        await sam.mutation(api.games.setPack, { code, pack: "tech" });
        const tech = await bob.query(api.board.get, { code });

        expect(tech.game.periodCount).toBe(143);
        expect(tech.stocks.map((stock) => stock.name)).toEqual(["ASML", "Facebook", "Nvidia", "Alibaba", "Apple", "Netflix"]);
        expect(tech.players.every((player) => player.cash === 3_000_000 && player.holdings.length === 6)).toBe(true);
        expect((await t.query(api.tv.board, { code }))?.game.pack).toBe("tech");
        await sam.mutation(api.games.setPack, { code, pack: "classic" });
        const restored = await bob.query(api.board.get, { code });

        expect(restored.game.periodCount).toBe(8);
        expect(restored.game.prices).toEqual(classic.game.prices);
        expect(restored.players.map((player) => [player.cash, player.holdings]))
            .toEqual(classic.players.map((player) => [player.cash, player.holdings]));
    });

    it("deals every Frantic player extra chance cards and equalizes Trusthouse and Natwest volatility", async () =>
    {
        const { t, sam, clients } = await setup();
        const classic = await sam.query(api.board.get, { code });

        await sam.mutation(api.games.setPack, { code, pack: "frantic" });
        await sam.mutation(api.games.start, { code });
        const boards = await Promise.all(clients.map((client) => client.query(api.board.get, { code })));

        expect(boards[0].game.prices).toEqual(classic.game.prices.map((price) =>
            ({ ...price, value: price.value * 3 })));
        expect(boards.every((board) => board.insights.length === 12
          && board.insights.filter((card) => card.chanceKind).length >= 2)).toBe(true);
        const catalog = await t.run((context) => context.db.query("gameCatalogs").first());
        const values = (key: number) => catalog!.cards.filter((card) => card.stockKey === key)
            .map((card) => card.value).toSorted((a, b) => a - b);

        expect(values(7)).toEqual(values(12));
        expect(Math.max(...values(12))).toBeGreaterThan(20);
        await expect(sam.mutation(api.games.setPack, { code, pack: "classic" })).rejects.toThrow("lobby host");
    });

    it("deals exclusive Tech windows and settles all 144 rounds to cached historical prices", async () =>
    {
        const { t, sam, clients } = await setup();
        const token = "b".repeat(64);
        const tvCode = "tech-tv";

        await t.mutation(api.tv.create, { code: tvCode, periodCount: 5, token });
        await expect(t.mutation(api.tv.setPack, { code: tvCode, token: "a".repeat(64), pack: "tech" }))
            .rejects.toThrow("controlling TV");
        await t.mutation(api.tv.setPack, { code: tvCode, token, pack: "tech" });

        for (const client of clients)
        {
            await client.mutation(api.games.join, { code: tvCode });
        }

        await t.mutation(api.tv.start, { code: tvCode, token });

        const boards = await Promise.all(clients.map((client) => client.query(api.board.get, { code: tvCode })));

        expect(boards.every((board) => board.insights.length === 12
          && board.insights.every((card) => card.playerId === board.player._id))).toBe(true);
        const windows = boards.map((board) => new Set(board.insights.map((card) => card.description)));

        expect(windows.every((hand) => hand.size === 2)).toBe(true);
        expect(new Set(windows.flatMap((hand) => [...hand])).size).toBe(clients.length * 2);

        const gameId = boards[0].game._id;
        const start = (await t.run((context) => context.db.get(gameId)))!.techStart!;

        expect(techPrices(chooseTechStart(0.999_999), techRoundCount)).toHaveLength(6);

        for (let expectedPeriod = 0; expectedPeriod < techRoundCount; expectedPeriod++)
        {
            await t.run((context) => context.db.patch(gameId, { status: "closed" }));

            if (expectedPeriod === 0)
            {
                const reveal = (await t.query(api.tv.board, { code: tvCode }))?.reveal;

                expect(reveal?.insights).toHaveLength(6);
                expect(reveal?.insights.every((card) => card.description === "Historical market close")).toBe(true);
            }

            await t.mutation(api.tv.next, { code: tvCode, token, expectedPeriod });
            const game = await t.run((context) => context.db.get(gameId));

            expect(game?.prices).toEqual(techPrices(start, expectedPeriod + 1));
        }

        const result = await sam.query(api.board.get, { code: tvCode });
        const allForecasts = await t.run((context) => context.db.query("playerInsights")
            .withIndex("by_game_period", (q) => q.eq("gameId", gameId)).collect());

        expect(result.game.status).toBe("finished");
        expect(result.game.priceHistory).toHaveLength(145);
        expect(allForecasts).toHaveLength(12 * 4 * 12);
    });

    it("lets a hard NPC use its own forecasts without sampling opponents' historical cards", async () =>
    {
        const { t, sam } = await setup(5, 1);

        await sam.mutation(api.games.setPack, { code, pack: "tech" });
        await sam.mutation(api.npc.lobby.add, { code, required: true });
        await sam.mutation(api.games.start, { code });
        const { game } = await sam.query(api.board.get, { code });
        const observation = await t.run(async (context) =>
        {
            const current = (await context.db.get(game._id))!;
            const players = await context.db.query("players").collect();
            const npc = players.find((player) => player.gameId === current._id && player.controller?.kind === "npc")!;

            return buildNpcObservation(context, current, npc);
        });

        expect(observation.catalog).toEqual([]);
        expect(estimate(observation, true, "tech").map(({ stockKey }) => stockKey)).toEqual([106, 101, 102, 103, 104, 105]);
    });

    it("shows the Crashing shock in the reveal and settles it while honoring a suspended stock", async () =>
    {
        const { t, sam } = await setup();

        await sam.mutation(api.games.setPack, { code, pack: "crashing" });
        await sam.mutation(api.games.start, { code });
        const { game } = await sam.query(api.board.get, { code });
        const protectedStock = game.prices[0].stockKey;

        await t.run((context) => context.db.patch(game._id, {
            currentPeriod: 2, status: "closed", suspended: [protectedStock],
        }));
        const board = await t.query(api.tv.board, { code });

        expect(board?.reveal?.insights).toHaveLength(6);
        expect(board?.reveal?.insights.every((card) => card.description.includes("Market crash"))).toBe(true);
        await sam.mutation(api.rounds.next, { code, expectedPeriod: 2 });
        const after = await sam.query(api.board.get, { code });

        expect(after.game.prices).toEqual(game.prices.map((price) => price.stockKey === protectedStock ? price
            : { ...price, value: Math.round(price.value * 70) / 100 }));
    });
});
