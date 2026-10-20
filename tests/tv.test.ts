import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { setup } from "./game-setup";

const modules = import.meta.glob("../convex/**/*.ts");
const token = "a".repeat(64);

describe("TV spectator integration", () =>
{
    it("creates without a player seat, hands hosting to the first phone, and launches through a device capability", async () =>
    {
        const t = convexTest(schema, modules);

        await t.mutation(api.tv.create, { code: "TV-NIGHT", periodCount: 5, token });
        await t.mutation(api.tv.create, { code: "TV-NIGHT", periodCount: 5, token });
        const waiting = await t.query(api.tv.board, { code: "tv-night" });

        expect(waiting?.players).toEqual([]);
        expect(waiting?.stocks).toHaveLength(6);
        await expect(t.mutation(api.tv.start, { code: "tv-night", token })).rejects.toThrow("four players");
        const ids = await t.run(async (context) => Promise.all(["Sam", "Alex", "Pat", "Robin"].map((name) =>
            context.db.insert("users", { name, profileRoot: "" }))));
        const clients = ids.map((id) => t.withIdentity({ subject: `${id}|session` }));
        for (const client of clients)
        {
            await client.mutation(api.games.join, { code: "tv-night" });
        }

        await clients[0].mutation(api.games.setLength, { code: "tv-night", periodCount: 6 });
        await expect(clients[1].mutation(api.games.setLength, { code: "tv-night", periodCount: 7 }))
            .rejects.toThrow("Only the lobby host");
        await expect(t.mutation(api.tv.start, { code: "tv-night", token: "b".repeat(64) }))
            .rejects.toThrow("Only the TV");
        await t.mutation(api.tv.start, { code: "tv-night", token });
        const playing = await t.query(api.tv.board, { code: "tv-night" });

        expect(playing?.game.status).toBe("playing");
        expect(playing?.players).toHaveLength(4);
        expect(playing?.game.currentPlayerId).toBe(playing?.players[0].id);
        expect(playing?.game.periodCount).toBe(6);
        await expect(t.mutation(api.tv.start, { code: "tv-night", token })).rejects.toThrow("already started");
    });

    it("reveals cards only after trading closes, while keeping account fields and capabilities private", async () =>
    {
        const { t, sam } = await setup();

        await sam.mutation(api.games.start, { code: "test" });
        const gameId = await t.run(async (context) => (await context.db.query("games").first())!._id);
        for (const status of ["playing", "closed", "special_insights", "finished"] as const)
        {
            await t.run(async (context) =>
            {
                await context.db.patch(gameId, { status, tvTokenHash: "private-capability-hash" });
            });
            const board = await t.query(api.tv.board, { code: "test" });
            const payload = JSON.stringify(board);

            expect(board?.players).toHaveLength(4);
            expect(board?.history).toHaveLength(1);
            expect(payload).not.toMatch(/"email"|tvToken|private-capability|hostId|userId|catalogCardId/);

            if (status === "closed" || status === "special_insights")
            {
                const phone = await sam.query(api.board.get, { code: "test" });

                expect(board?.reveal?.insights).toHaveLength(phone.insights.length);
                expect(board?.reveal?.insights.map((item) => item.description))
                    .toEqual(phone.insights.map((item) => item.description));
                expect(board?.reveal?.prices).toEqual(phone.game.prices);
                expect(board?.reveal?.stocks).toHaveLength(phone.stocks.length);
            }
            else
            {
                expect(board?.reveal).toBeNull();
                expect(payload).not.toMatch(/"insights"|"description"/);
            }
        }
    });

    it("streams actual public trades and holdings and returns missing games safely", async () =>
    {
        const { t, sam } = await setup();

        await sam.mutation(api.games.start, { code: "test" });
        const board = (await sam.query(api.board.get, { code: "test" }));
        const stock = board.stocks.find((item) => item.display)!;

        await sam.mutation(api.trading.play, {
            code: "test", stockKey: stock.key, quantity: 1000, expectedPeriod: 0, expectedTurn: 0,
        });
        const spectator = await t.query(api.tv.board, { code: "test" });

        expect(spectator?.stocks.find((item) => item.key === stock.key)?.held).toBe(1000);
        expect(spectator?.feed[0].quantity).toBe(1000);
        expect(spectator?.feed[0].imageRoot).toBe(board.user.profileRoot);
        expect(spectator?.feed[0].message).toContain(stock.name);
        await t.run(async (context) =>
        {
            for (let index = 0; index < 30; index++)
            {
                await context.db.insert("feed", { gameId: board.game._id, period: 0,
                    title: "bob", message: "passed their go", imageRoot: "", colour: "" });
            }
        });
        const later = await t.query(api.tv.board, { code: "test" });

        expect(later?.latestPurchase?.message).toContain(stock.name);
        expect(later?.feed).toHaveLength(24);
        expect(await t.query(api.tv.board, { code: "missing" })).toBeNull();
    });

    it("reveals the completed round and hides the newly dealt round after the host continues", async () =>
    {
        const { t, sam, clients } = await setup();

        await sam.mutation(api.games.start, { code: "test" });

        for (let turn = 0; turn < clients.length * 3; turn++)
        {
            await clients[turn % clients.length].mutation(api.trading.play, {
                code: "test", expectedPeriod: 0, expectedTurn: turn,
            });
        }

        const closed = await t.query(api.tv.board, { code: "test" });

        expect(closed?.game.status).toBe("closed");
        expect(closed?.reveal?.insights.length).toBeGreaterThan(0);
        await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 });
        const next = await t.query(api.tv.board, { code: "test" });

        expect(next?.game.currentPeriod).toBe(1);
        expect(next?.game.status).toBe("playing");
        expect(next?.reveal).toBeNull();
        expect(JSON.stringify(next)).not.toMatch(/"description"|"insights"/);
    });

    it("rejects invalid creation and capability reuse by other devices", async () =>
    {
        const t = convexTest(schema, modules);

        await expect(t.mutation(api.tv.create, { code: "tv", periodCount: 1, token })).rejects.toThrow("length");
        await expect(t.mutation(api.tv.create, { code: "tv", periodCount: 5, token: "short" }))
            .rejects.toThrow("token");
        await t.mutation(api.tv.create, { code: "tv", periodCount: 5, token });
        await expect(t.mutation(api.tv.create, { code: "tv", periodCount: 5, token: "b".repeat(64) }))
            .rejects.toThrow("already exists");
    });
});
