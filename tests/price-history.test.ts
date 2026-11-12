import { skipDealtSuspensions } from "./game-setup";
import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { chartDateAxis, chartSeries, priceSeries } from "../src/price-history";
import { tooltipLabel, tradeMarkerLayout, TradeStack } from "../src/TradeMarkers";
import { packIds } from "../shared/packs";
import { roundProgress } from "../src/round-preview";
import { setup } from "./game-setup";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

describe("Stock history and investors", () =>
{
    it("labels wide Tech charts with dated boundaries while keeping numeric ticks on narrow and Classic charts", () =>
    {
        const boundaries = ["2024-11-01", "2024-12-31", "2025-02-28", "2025-04-30", "2025-06-30"];
        const tradingDates = { from: boundaries[0], to: boundaries[1], boundaries, dailyCloses: [] };
        const game = { pack: "tech" as const, tradingDates };
        const axis = chartDateAxis(game, 4, 310);

        expect(axis?.ticks).toEqual([0, 1, 3, 4]);
        expect(axis?.format(4)).toBe("30 Jun 2025");
        expect(chartDateAxis(game, 4, 250)).toBeUndefined();
        expect(chartDateAxis({ ...game, pack: "classic" }, 4, 800)).toBeUndefined();
    });

    it("uses the actual market dates for partial reveals and the opening quote date for trades", () =>
    {
        const stockKey = 104;
        const trade = { stockKey, period: 0, bargainRound: 1, title: "Sam", imageRoot: "", quantity: 1000 };
        const opening = [{ stockKey, value: 100 }];
        const points = priceSeries({
            currentPeriod: 0, periodCount: 0, prices: opening,
            tradingDates: { from: "2024-12-31", to: "2025-01-06", boundaries: ["2024-12-31", "2025-01-06"],
                dailyCloses: [["2025-01-02", "2025-01-03", "2025-01-06"]] },
            priceHistory: [{ period: 0, prices: opening }, { period: 1, prices: opening,
                steps: [{ stockKey, values: [102, 101], count: 3 }] }],
        }, stockKey, new Map([[0, [[trade]]]]));

        expect(points.map((point) => point.date)).toEqual(["2024-12-31", "2024-12-31", "2025-01-02", "2025-01-03"]);
        expect(tooltipLabel(points[2].round, points[2])).toBe("2 January 2025");
        expect(tooltipLabel(1)).toBe("Period 1");
    });

    it("starts NatWest at £8 and corrects an existing £9 catalog without rewriting saved games", async () =>
    {
        const { t, sam } = await setup();
        const initial = await sam.query(api.board.get, { code: "test" });

        expect(initial.game.prices.find((price) => price.stockKey === 12)?.value).toBe(8);
        await t.run(async (context) =>
        {
            const stock = await context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", 12)).unique();
            const prices = initial.game.prices.map((price) => price.stockKey === 12 ? { ...price, value: 9 } : price);

            await context.db.patch(stock!._id, { startingValue: 9 });
            await context.db.patch(initial.game._id, { prices, priceHistory: [{ period: 0, prices }] });
        });
        await sam.mutation(api.games.create, { code: "new-prices", periodCount: 5 });
        const next = await sam.query(api.board.get, { code: "new-prices" });
        const saved = await sam.query(api.board.get, { code: "test" });

        expect(next.game.prices.find((price) => price.stockKey === 12)?.value).toBe(8);
        expect(next.game.priceHistory?.[0].prices.find((price) => price.stockKey === 12)?.value).toBe(8);
        expect(saved.game.prices.find((price) => price.stockKey === 12)?.value).toBe(9);
        expect(saved.game.priceHistory?.[0].prices.find((price) => price.stockKey === 12)?.value).toBe(9);
    });

    it("shows the complete round axis while leaving unrevealed prices empty", () =>
    {
        const prices = [{ stockKey: 8, value: 2.5 }];
        const game = { periodCount: 5, currentPeriod: 0, prices,
            priceHistory: [{ period: 0, prices }] };
        const initial = priceSeries(game, 8);

        expect(initial.map((point) => point.round)).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(initial.map((point) => point.value)).toEqual([2.5, null, null, null, null, null, null]);
        game.priceHistory.push({ period: 1, prices: [{ stockKey: 8, value: 3 }] });
        expect(priceSeries(game, 8).map((point) => point.value)).toEqual([2.5, 3, null, null, null, null, null]);
    });
    it("records starting and settled prices once, without exposing next-round prices during trading", async () =>
    {
        const { sam, bob, clients } = await setup();

        await sam.mutation(api.games.start, { code: "test" });
        const initial = await sam.query(api.board.get, { code: "test" });

        expect(initial.game.priceHistory).toEqual([{ period: 0, prices: initial.game.prices }]);
        await sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, expectedPeriod: 0, stockKey: 8, quantity: 1000 });

        for (let turn = 1; turn < 12; turn++)
        {
            const quantity = turn === 2 ? 1000 : (turn === 8 ? -1000 : 0);

            await clients[turn % 4].mutation(api.trading.play, { code: "test", expectedTurn: turn, expectedPeriod: 0,
                ...(quantity ? { stockKey: 8, quantity } : {}) });
        }

        const closed = await sam.query(api.board.get, { code: "test" });

        expect(closed.game.priceHistory).toEqual(initial.game.priceHistory);
        const trade = { stockKey: 8, period: 0, bargainRound: 1, title: closed.user.name,
            imageRoot: closed.user.profileRoot, quantity: 1000 };
        const otherBuy = { ...trade, title: "pat" };
        const sale = { ...trade, bargainRound: 3, quantity: -1000 };

        expect(closed.trades).toEqual([trade, otherBuy, sale]);
        expect((await sam.query(api.tv.board, { code: "test" }))?.reveal?.trades).toEqual(closed.trades);
        expect(chartSeries(closed.game, 8, closed.trades).flatMap((point) => point.trades ?? []))
            .toEqual(closed.trades);
        await skipDealtSuspensions(sam, "test");
        await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 });
        const settled = await bob.query(api.board.get, { code: "test" });

        expect(settled.game.priceHistory).toEqual([
            { period: 0, prices: initial.game.prices },
            expect.objectContaining({ period: 1, prices: settled.game.prices }),
        ]);

        const points = chartSeries(settled.game, 8, [...settled.trades, { ...trade, period: 2 }])
            .filter((point) => point.round <= 1);
        const tradePoints = points.filter((point) => point.trades);

        expect(tradePoints.map(({ value, trades }) => ({ value, trades }))).toEqual([
            { value: 2.5, trades: [trade, otherBuy] },
            { value: 2.5, trades: [sale] },
        ]);
        const positions = points.map((point) => point.round);

        expect(positions).toEqual(positions.toSorted((a, b) => a - b));
        expect(points.at(-1)?.round).toBe(1);

        for (const price of settled.game.prices)
        {
            const start = initial.game.prices.find((item) => item.stockKey === price.stockKey)?.value ?? 0;
            const change = closed.insights.filter((insight) => insight.stockKey === price.stockKey)
                .reduce((sum, insight) => sum + insight.value, 0);

            expect(price.value).toBe(Math.max(0, start + change));
        }

        await expect(sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 })).rejects.toThrow();
        expect((await sam.query(api.board.get, { code: "test" })).game.priceHistory).toEqual(settled.game.priceHistory);
        expect(settled.insights.filter((card) => card.period === settled.game.currentPeriod)).toHaveLength(10);
    });
    it("begins history at the current price when a game has no recorded quotes", async () =>
    {
        const { t, sam } = await setup();

        await sam.mutation(api.games.start, { code: "test" });
        const board = await sam.query(api.board.get, { code: "test" });

        await t.run(async (context) =>
        {
            await context.db.patch(board.game._id, { priceHistory: undefined, currentPeriod: 2, status: "closed" });
        });
        await skipDealtSuspensions(sam, "test");
        await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 2 });
        const next = await sam.query(api.board.get, { code: "test" });

        expect(next.game.priceHistory).toEqual([
            { period: 2, prices: board.game.prices }, expect.objectContaining({ period: 3, prices: next.game.prices }),
        ]);
    });
});

for (const pack of packIds)
{
    it(`shows ${pack} buys and sells during trading, the reveal and the settled history`, async () =>
    {
        const { t, sam, clients } = await setup();
        const code = "test";

        await sam.mutation(api.games.setPack, { code, pack });
        await sam.mutation(api.games.start, { code });
        const opened = await sam.query(api.board.get, { code });
        const stockKey = opened.stocks.find((stock) => stock.display)!.key;
        const opening = opened.game.prices.find((quote) => quote.stockKey === stockKey)?.value;
        for (let turn = 0; turn < 12; turn++)
        {
            const quantity = turn === 0 ? 1000 : (turn === 4 ? -1000 : 0);

            await clients[turn % clients.length].mutation(api.trading.play, {
                code, expectedPeriod: 0, expectedTurn: turn, ...(quantity && { stockKey, quantity }),
            });

            if (turn === 4)
            {
                const live = await sam.query(api.board.get, { code });
                const points = chartSeries(live.game, stockKey, live.trades).filter((point) => point.value !== null);

                const publicBoard = (await t.query(api.tv.board, { code }))!;

                expect(publicBoard.reveal).toBeNull();
                expect(publicBoard.trades).toEqual(live.trades);
                expect(points.every((point) => point.value === opening)).toBe(true);
                expect(points.flatMap((point) => point.trades?.map((trade) => trade.quantity) ?? []))
                    .toEqual([1000, -1000]);
            }
        }

        const closed = await sam.query(api.board.get, { code });
        const publicReveal = (await t.query(api.tv.board, { code }))!.reveal!;
        const { preview } = roundProgress(closed, 0, 0);
        const revealed = chartSeries(preview.game, stockKey, publicReveal.trades);
        const markers = revealed.filter((point) => point.trades);

        expect(markers.flatMap((point) => point.trades?.map((trade) => trade.quantity) ?? [])).toEqual([1000, -1000]);

        if (pack === "tech")
        {
            expect(markers).toHaveLength(1);
            expect(markers[0].date).toBe(closed.game.tradingDates?.from);
            expect(tradeMarkerLayout(revealed, 260, 130, 12).size).toBeGreaterThan(10);
        }

        await skipDealtSuspensions(sam, code);
        await sam.mutation(api.rounds.next, { code, expectedPeriod: 0 });
        const settled = await sam.query(api.board.get, { code });

        expect(chartSeries(settled.game, stockKey, settled.trades).filter((point) => point.trades)).toEqual(markers);
    });
}

it("records each insight within a fixed round column and retains the path in subsequent rounds", async () =>
{
    const { t, sam } = await setup();

    await sam.mutation(api.games.start, { code: "test" });
    const board = await sam.query(api.board.get, { code: "test" });

    await t.run(async (context) =>
    {
        for (const card of await context.db.query("playerInsights").collect())
        {
            await context.db.delete(card._id);
        }

        for (const value of [-4, 2, 1])
        {
            await context.db.insert("playerInsights", { gameId: board.game._id, playerId: board.player._id,
                period: 0, stockKey: 8, value, description: "Price movement", resolved: true });
        }

        await context.db.patch(board.game._id, { status: "closed" });
    });
    await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 });
    const settled = await sam.query(api.board.get, { code: "test" });
    const points = priceSeries(settled.game, 8).filter((point) => point.value !== null);

    expect(points).toEqual([
        { round: 0, value: 2.5 },
        { round: 1 / 3, value: 0 },
        { round: 2 / 3, value: 0.5 },
        { round: 1, value: 1.5 },
    ]);
    expect(settled.game.prices.find((price) => price.stockKey === 8)?.value).toBe(1.5);
    expect(priceSeries({ ...settled.game, currentPeriod: 2 }, 8).slice(0, 4)).toEqual(points);
});

it("keeps a portrait for every trade in a dense Frantic period", () =>
{
    const stockKey = 12;
    const prices = [{ stockKey, value: 24 }];
    const trades = Array.from({ length: 18 }, (_, index) => ({
        stockKey, period: 0, bargainRound: 1, title: `Player ${index}`, imageRoot: `/portrait/${index}`, quantity: 1000,
    }));
    const game = { code: "dense", status: "playing" as const, suspended: [],
        pack: "frantic" as const, currentPeriod: 1, periodCount: 9, prices,
        priceHistory: [{ period: 0, prices }, { period: 1, prices,
            steps: [{ stockKey, values: Array.from({ length: 26 }, () => 24), count: 26 }] }] };
    const points = chartSeries(game, stockKey, trades);
    const layout = tradeMarkerLayout(points, 220, 115, 10);
    const marker = points.find((point) => point.trades)!;
    const markup = renderToStaticMarkup(createElement("svg", {}, createElement(TradeStack, {
        trades: marker.trades!, x: 25, y: 100, layout,
    })));

    expect(layout.size).toBeGreaterThanOrEqual(10);
    expect(markup.match(/<image /g)).toHaveLength(trades.length);
});
