import { expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { setup } from "./game-setup";

it("keeps old chart markers when an existing game starts recording trades in the next period", async () =>
{
    const { t, sam, bob } = await setup();
    const code = "test";

    await sam.mutation(api.games.start, { code });
    const opened = await sam.query(api.board.get, { code });
    const gameId = opened.game._id;
    const trade = { stockKey: 8, quantity: 1000 };
    const history = { gameId, seatCount: opened.players.length };

    await sam.mutation(api.trading.play, { code, expectedPeriod: 0, expectedTurn: 0, ...trade });
    await t.run(async (context) =>
    {
        const feed = await context.db.query("feed").withIndex("by_game", (q) => q.eq("gameId", gameId)).collect();
        for (const entry of feed)
        {
            await context.db.patch(entry._id, { bargainRound: undefined, chartPeriod: undefined });
        }

        const cards = await context.db.query("playerInsights")
            .withIndex("by_game_period", (q) => q.eq("gameId", gameId).eq("period", 0)).collect();
        for (const card of cards)
        {
            await context.db.delete(card._id);
        }

        await context.db.patch(gameId, { tradeHistoryStart: undefined, status: "closed" });
    });
    const legacy = await t.query(api.tv.trades, history);

    expect(legacy).toMatchObject([{ ...trade, period: 0, bargainRound: 1 }]);
    await sam.mutation(api.rounds.next, { code, expectedPeriod: 0 });
    expect((await bob.query(api.board.get, { code })).game.tradeHistoryStart).toBe(1);
    await bob.mutation(api.trading.play, { code, expectedPeriod: 1, expectedTurn: 0, ...trade });
    const mixed = await t.query(api.tv.trades, { ...history, start: 1 });

    expect(mixed).toEqual(await t.query(api.tv.trades, history));
    expect(mixed[0]).toEqual(legacy[0]);
    expect(mixed[1]).toMatchObject({ ...trade, period: 1, bargainRound: 1, title: "bob" });
});
