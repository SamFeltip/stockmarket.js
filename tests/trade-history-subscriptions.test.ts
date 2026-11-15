import { expect, it } from "vitest";
import { makeFunctionReference } from "convex/server";
import { tradeHistoryRequests } from "../src/use-trade-history";

const trades = makeFunctionReference<"query", {
    gameId: string; seatCount: number; start?: number; range?: { from: number; before: number };
}, string[]>("tv:trades");

it("subscribes to stable, contiguous ranges including the final period", () =>
{
    const history = { gameId: "game", seatCount: 6, start: 0 };
    const requests = Object.values(tradeHistoryRequests(trades, history, 17));

    expect(requests.map(({ args }) => args.range)).toEqual([
        { from: 0, before: 4 }, { from: 4, before: 8 }, { from: 8, before: 12 },
        { from: 12, before: 16 }, { from: 16, before: 20 },
    ]);
});

const testOldHistory = it.each([undefined, 4]);

testOldHistory("keeps a single history query for existing saves with cutoff %s", (start) =>
{
    const history = { gameId: "game", seatCount: 6, start };

    expect(tradeHistoryRequests(trades, history, 47)).toEqual({ history: { query: trades, args: history } });
});
