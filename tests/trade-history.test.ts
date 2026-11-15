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

it("returns all markers in order across fixed subscription ranges and keeps earlier ranges stable", async () =>
{
    const { t, sam } = await setup(8);
    const code = "test";
    const board = await sam.query(api.board.get, { code });
    const gameId = board.game._id;
    const history = { gameId, seatCount: board.players.length, start: 0 };
    const first = { ...history, range: { from: 0, before: 4 } };
    const second = { ...history, range: { from: 4, before: 8 } };
    const last = { ...history, range: { from: 8, before: 12 } };
    const insertTrade = (period: number, title: string) => t.run((context) => context.db.insert("feed", {
        gameId, period, title, message: "bought 1000 shares", imageRoot: "", colour: "",
        chartPeriod: period, bargainRound: 1, stockKey: 8, quantity: 1000,
    }));

    await insertTrade(3, "First");
    await insertTrade(4, "Second");
    await insertTrade(8, "Final");
    const earlier = await t.query(api.tv.trades, first);

    await insertTrade(4, "Third");
    expect(await t.query(api.tv.trades, first)).toEqual(earlier);
    const current = await t.query(api.tv.trades, second);
    const ending = await t.query(api.tv.trades, last);

    expect(current.map((trade) => trade.title)).toEqual(["Second", "Third"]);
    expect([...earlier, ...current, ...ending]).toEqual(await t.query(api.tv.trades, history));
    expect(ending.map((trade) => trade.title)).toEqual(["Final"]);
});
