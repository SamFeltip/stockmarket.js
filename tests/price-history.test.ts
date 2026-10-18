import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { priceSeries } from "../src/price-history";
import { setup } from "./game-setup";

describe("Stock history and investors", () =>
{
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
            await clients[turn % 4].mutation(api.trading.play, { code: "test", expectedTurn: turn, expectedPeriod: 0 });
        }

        const closed = await sam.query(api.board.get, { code: "test" });

        expect(closed.game.priceHistory).toEqual(initial.game.priceHistory);
        await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 });
        const settled = await bob.query(api.board.get, { code: "test" });

        expect(settled.game.priceHistory).toEqual([
            { period: 0, prices: initial.game.prices }, { period: 1, prices: settled.game.prices },
        ]);

        for (const price of settled.game.prices)
        {
            const start = initial.game.prices.find((item) => item.stockKey === price.stockKey)?.value ?? 0;
            const change = closed.insights.filter((insight) => insight.stockKey === price.stockKey)
                .reduce((sum, insight) => sum + insight.value, 0);

            expect(price.value).toBe(Math.max(0, start + change));
        }

        await expect(sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 })).rejects.toThrow();
        expect((await sam.query(api.board.get, { code: "test" })).game.priceHistory).toEqual(settled.game.priceHistory);
        expect(settled.insights).toHaveLength(10);
    });
    it("begins history at the current price for older games without inventing past prices", async () =>
    {
        const { t, sam } = await setup();
        const board = await sam.query(api.board.get, { code: "test" });

        await t.run(async (context) =>
        {
            await context.db.patch(board.game._id, { priceHistory: undefined, currentPeriod: 2, status: "closed" });
        });
        await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 2 });
        const next = await sam.query(api.board.get, { code: "test" });

        expect(next.game.priceHistory).toEqual([
            { period: 2, prices: board.game.prices }, { period: 3, prices: next.game.prices },
        ]);
    });
});
