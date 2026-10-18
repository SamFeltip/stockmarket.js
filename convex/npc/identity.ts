import type { Doc as Document_ } from "../_generated/dataModel";
import type { QueryCtx as QueryContext } from "../_generated/server";
import { identity } from "../game/seats";
import { roster } from "../../packages/npc-engine/src/roster";
export async function publicIdentity(context: QueryContext, seat: Document_<"players">)
{
    if (seat.controller?.kind === "npc")
    {
        const personality = seat.controller.personality;
        const entry = roster.find((item) => item.id === personality)!;

        return {
            name: entry.name,
            profileRoot: entry.portrait,
            tagline: entry.tagline,
            kind: "npc" as const,
        };
    }

    return identity(context, seat);
}
