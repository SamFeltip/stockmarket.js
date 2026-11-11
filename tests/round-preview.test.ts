import { skipDealtSuspensions } from "./game-setup";
import { expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { previewRound, roundProgress } from "../src/round-preview";
import { chartSeries, priceSeries } from "../src/price-history";
import { setup } from "./game-setup";

it("updates revealed wealth and charts before advancing, matching settled stock and currency values", async () =>
{
    const { t, sam } = await setup();

    await sam.mutation(api.games.start, { code: "test" });
    const initial = await sam.query(api.board.get, { code: "test" });

    await t.run(async (context) =>
    {
        await context.db.patch(initial.game._id, { status: "closed", suspended: [9] });
        await context.db.patch(initial.player._id, { cash: 1000, holdings: [
            { stockKey: 8, quantity: 1000 }, { stockKey: 9, quantity: 1000 },
        ] });
        await context.db.insert("stocks", { key: 13, name: "currency", display: false, variation: 0,
            startingValue: 0, imagePath: "", secondaryImagePath: "" });
        const insights = await context.db.query("playerInsights").collect();
        for (const insight of insights)
        {
            await context.db.patch(insight._id, { value: 0 });
        }

        await context.db.patch(insights[0]._id, { stockKey: 8, value: -10 });
        await context.db.patch(insights[1]._id, { stockKey: 9, value: 10 });
        await context.db.patch(insights[2]._id, { stockKey: 13, value: 0.1, playerId: initial.player._id });
    });
    const before = await sam.query(api.board.get, { code: "test" });
    const partial = previewRound(before, before.insights.filter((insight) => insight.stockKey === 8), [8]);

    expect(partial.players[0].netWorth).toBe(5000);
    expect(before.players[0].netWorth).toBe(7500);
    expect(priceSeries(partial.game, 8)[1].value).toBe(0);
    expect(priceSeries(partial.game, 9)[1].value).toBeNull();
    const complete = previewRound(before, before.insights, before.stocks.map((stock) => stock.key));

    expect(complete.players[0].cash).toBe(1000);
    expect(complete.players[0].netWorth).toBe(5000);
    expect(complete.game.prices.find((price) => price.stockKey === 9)?.value).toBe(4);
    await skipDealtSuspensions(sam, "test");
    await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 });
    const settled = await sam.query(api.board.get, { code: "test" });

    expect(complete.game.prices).toEqual(settled.game.prices);
    expect(complete.game.priceHistory).toEqual(settled.game.priceHistory);
    expect(complete.players.map((player) => [player.cash, player.netWorth, player.ranking]))
        .toEqual(settled.players.map((player) => [player.cash, player.netWorth, player.ranking]));
});

it("applies each stock's wealth change only on its summary, including skipped animations", async () =>
{
    const { sam } = await setup();

    await sam.mutation(api.games.start, { code: "test" });
    const board = await sam.query(api.board.get, { code: "test" });

    board.insights = [
        { ...board.insights[0], stockKey: 7, value: 1 },
        { ...board.insights[1], stockKey: 8, value: -0.5 },
    ];
    board.players[0] = { ...board.players[0], cash: 1000, netWorth: 8000,
        holdings: [{ stockKey: 7, quantity: 1000 }, { stockKey: 8, quantity: 2000 }] };

    expect(roundProgress(board, 0, 0).wealth.players[0].netWorth).toBe(8000);
    expect(roundProgress(board, 0, 0).preview.players[0].netWorth).toBe(9000);
    expect(roundProgress(board, 0, 1).wealth.players[0].netWorth).toBe(9000);
    expect(roundProgress(board, 1, 0).wealth.players[0].netWorth).toBe(9000);
    expect(roundProgress(board, 1, 1).wealth.players[0].netWorth).toBe(8000);
    expect(roundProgress(board, 6, 0).wealth.players[0].netWorth).toBe(8000);
    expect(board.players[0].netWorth).toBe(8000);
});

it("adds only revealed card segments and reserves the remaining round width", async () =>
{
    const { sam } = await setup();
    const board = await sam.query(api.board.get, { code: "test" });

    board.insights = [1, -0.5, 0.25].map((value, index) => ({
        ...board.insights[index], stockKey: 8, value,
    }));
    const partial = previewRound(board, board.insights.slice(0, 1), [8]);
    const complete = previewRound(board, board.insights, [8]);

    expect(priceSeries(partial.game, 8).filter((point) => point.value !== null)).toEqual([
        { round: 0, value: 2.5 }, { round: 1 / 3, value: 3.5 },
    ]);
    expect(priceSeries(complete.game, 8).filter((point) => point.value !== null)).toEqual([
        { round: 0, value: 2.5 }, { round: 1 / 3, value: 3.5 },
        { round: 2 / 3, value: 3 }, { round: 1, value: 3.25 },
    ]);
    expect(priceSeries(partial.game, 9).filter((point) => point.value !== null)).toHaveLength(1);

    const trade = { stockKey: 8, period: 0, bargainRound: 1, title: "Sam", imageRoot: "", quantity: 1000 };
    const futureTrade = { ...trade, period: 1 };

    expect(chartSeries(board.game, 8, [trade]).some((point) => point.trades)).toBe(false);
    expect(chartSeries(partial.game, 8, [trade, futureTrade]).filter((point) => point.value !== null)).toEqual([
        { round: 0, value: 2.5 }, { round: 0.25, value: 2.5, trades: [trade] }, { round: 0.5, value: 3.5 },
    ]);
    expect(chartSeries(complete.game, 8, [trade]).filter((point) => point.value !== null)).toEqual([
        { round: 0, value: 2.5 }, { round: 0.25, value: 2.5, trades: [trade] },
        { round: 0.5, value: 3.5 }, { round: 0.75, value: 3 }, { round: 1, value: 3.25 },
    ]);
});
