import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { setup } from "./game-setup";

describe("Stock history and investors", () =>
{
    it("records starting and settled prices once, without exposing next-round prices during trading", async () =>
    {
        const { sam, bob } = await setup();

        await sam.mutation(api.games.start, { code: "test" });
        const initial = await sam.query(api.board.get, { code: "test" });

        expect(initial.game.priceHistory).toEqual([{ period: 0, prices: initial.game.prices }]);
        await sam.mutation(api.trading.play, { code: "test", expectedTurn: 0, stockKey: 8, quantity: 1000 });

        for (let turn = 1; turn < 6; turn++)
        {
            await (turn % 2 === 0 ? sam : bob).mutation(api.trading.play, { code: "test", expectedTurn: turn });
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
