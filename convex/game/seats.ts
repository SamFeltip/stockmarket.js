import type { Doc as Document_ } from "../_generated/dataModel";
import type { QueryCtx as QueryContext } from "../_generated/server";
export { isNpc, isCurrent } from "../../../stockmarket-shared/src/engine/seats";

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
