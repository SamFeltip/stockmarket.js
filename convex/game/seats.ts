import type { Doc as Document_ } from "../_generated/dataModel";
import type { QueryCtx as QueryContext } from "../_generated/server";
export function isNpc(seat: Document_<"players">): boolean
{
    return seat.controller?.kind === "npc";
}

export function isCurrent(game: Document_<"games">, seat: Document_<"players">): boolean
{
    return game.currentPlayerId
        ? game.currentPlayerId === seat._id
        : !!seat.userId && game.currentUserId === seat.userId;
}

export async function identity(context: QueryContext, seat: Document_<"players">)
{
    const account = seat.userId ? await context.db.get(seat.userId) : null;

    return {
        name: account?.name ?? "Unknown",
        profileRoot: account?.profileRoot ?? "",
        tagline: "",
        kind: "human" as const,
    };
}
