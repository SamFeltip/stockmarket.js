import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { useTradeHistory } from "./use-trade-history";

// Generated API properties return a new reference on each access.
const tradeHistoryQuery = api.tv.trades;

export function useBoardSubscriptions(
    gameId: Id<"games"> | undefined, period: number | undefined, waiting: boolean,
    seatCount: number, start: number | undefined, lastPeriod: number | undefined,
)
{
    const cursor = useQuery(api.rounds.progress, gameId ? { gameId } : "skip");
    const trades = useTradeHistory(tradeHistoryQuery, gameId && !waiting ? { gameId, seatCount, start } : undefined,
        lastPeriod);

    return { cursor: cursor?.period === period ? cursor : undefined, trades,
        loading: Boolean(gameId && (cursor === undefined || (!waiting && trades === undefined))) };
}
