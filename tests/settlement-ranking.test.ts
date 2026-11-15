import { expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { cashStockKey } from "../shared/chance-cards";
import { setup } from "./game-setup";

it("settles cash and ranks tied players in seat order using each player's Frantic quote", async () =>
{
    const { t, sam } = await setup();
    const code = "test";

    await sam.mutation(api.games.setPack, { code, pack: "frantic" });
    await sam.mutation(api.games.start, { code });
    const board = await sam.query(api.board.get, { code });
    const [first, second, frozen, fourth] = board.players;
    const gameId = board.game._id;
    const stockKey = 8;

    await t.run(async (context) =>
    {
        const cards = await context.db.query("playerInsights")
            .withIndex("by_game_period", (q) => q.eq("gameId", gameId).eq("period", 0)).collect();
        for (const card of cards)
        {
            await context.db.delete(card._id);
        }

        await context.db.patch(first._id, { cash: 25_000, holdings: [{ stockKey, quantity: 1000 }] });
        await context.db.patch(second._id, { cash: 25_000, holdings: [{ stockKey, quantity: 1000 }] });
        await context.db.patch(frozen._id, { cash: 25_000, holdings: [{ stockKey, quantity: 1000 }] });
        await context.db.patch(fourth._id, { cash: 0, holdings: [] });
        await context.db.insert("playerInsights", { gameId, playerId: first._id, period: 0,
            stockKey: cashStockKey, description: "Cash", value: 0.1, resolved: false });
        await context.db.insert("playerInsights", { gameId, playerId: second._id, period: 0,
            stockKey, description: "Price rise", value: 3, resolved: false });
        await context.db.patch(gameId, { status: "closed",
            targetedSuspensions: [{ stockKey, playerIds: [frozen._id] }] });
    });

    await sam.mutation(api.rounds.next, { code, expectedPeriod: 0 });
    const settled = await t.run(async (context) => await Promise.all(
        board.players.map((seat) => context.db.get(seat._id)),
    ));

    expect(settled.map((seat) => seat?.cash)).toEqual([27_500, 27_500, 27_500, 0]);
    expect(settled.map((seat) => seat?.periodStartRanking)).toEqual([1, 2, 3, 4]);
    const next = await sam.query(api.board.get, { code });

    expect(next.players.map((seat) => seat.ranking)).toEqual([1, 2, 3, 4]);
    expect(next.players[0].netWorth).toBe(next.players[1].netWorth);
    expect(next.players[1].netWorth).toBeGreaterThan(next.players[2].netWorth);
});
