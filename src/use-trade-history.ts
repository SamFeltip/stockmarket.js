import { useMemo } from "react";
import { useQueries } from "convex/react";
import type { FunctionReference } from "convex/server";

type HistoryArguments<GameId extends string> = Readonly<{
    gameId: GameId; seatCount: number; start?: number; range?: { from: number; before: number };
}>;

const periodsPerQuery = 4;

export function useTradeHistory<GameId extends string, Trade>(
    query: FunctionReference<"query", "public", HistoryArguments<GameId>, Trade[]>,
    history: Omit<HistoryArguments<GameId>, "range"> | undefined,
    lastPeriod: number | undefined,
)
{
    const { gameId, seatCount, start } = history ?? {};
    const queries = useMemo(() => gameId && seatCount !== undefined
        ? tradeHistoryRequests(query, { gameId, seatCount, start }, lastPeriod ?? 0)
        : {}, [gameId, lastPeriod, query, seatCount, start]);
    const results = useQueries(queries) as Record<string, Trade[] | Error | undefined>;

    return useMemo(() =>
    {
        const trades: Trade[] = [];
        for (const key of Object.keys(queries))
        {
            const page = results[key];
            if (page instanceof Error)
            {
                throw page;
            }

            if (page === undefined)
            {
                return;
            }

            trades.push(...page);
        }

        return trades;
    }, [queries, results]);
}

export function tradeHistoryRequests<GameId extends string, Trade>(
    query: FunctionReference<"query", "public", HistoryArguments<GameId>, Trade[]>,
    history: HistoryArguments<GameId>,
    lastPeriod: number,
)
{
    if (history.start !== 0 || lastPeriod < periodsPerQuery)
    {
        return { history: { query, args: history } };
    }

    // Keep these ranges fixed for the whole game so advancing a period keeps every subscription attached.
    return Object.fromEntries(Array.from({ length: Math.ceil((lastPeriod + 1) / periodsPerQuery) }, (_, index) =>
    {
        const from = index * periodsPerQuery;

        return [String(from), { query, args: { ...history, range: { from, before: from + periodsPerQuery } } }];
    }));
}
