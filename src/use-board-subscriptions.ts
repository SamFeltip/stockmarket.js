import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

export function useBoardSubscriptions(
    gameId: Id<"games"> | undefined, period: number | undefined, waiting: boolean,
    seatCount: number, start: number | undefined,
)
{
    const cursor = useQuery(api.rounds.progress, gameId ? { gameId } : "skip");
    const trades = useQuery(api.tv.trades, gameId && !waiting ? { gameId, seatCount, start } : "skip");

    return { cursor: cursor?.period === period ? cursor : undefined, trades,
        loading: Boolean(gameId && (cursor === undefined || (!waiting && trades === undefined))) };
}
