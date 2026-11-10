import { advanceNpcSuspensions as advance } from "../../../stockmarket-shared/src/engine/npcSuspensions";
import { v } from "convex/values";
import { runEngine } from "../engine";
import { internalMutation } from "../_generated/server";
import type { MutationCtx as MutationContext } from "../_generated/server";
import type { Doc as Document_ } from "../_generated/dataModel";

export function advanceNpcSuspensions(context: MutationContext, game: Document_<"games">)
{
    return runEngine(context, (runtime) => advance(runtime, game));
}

export const run = internalMutation({
    args: { gameId: v.id("games"), insightId: v.id("playerInsights") },
    handler: async (context, { gameId, insightId }) =>
    {
        const game = await context.db.get(gameId);
        if (game)
        {
            await runEngine(context, (runtime) => advance(runtime, game, insightId));
        }
    },
});
