import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { purchase } from "../rightsIssue";

import { advanceNpcRights as advance, npcRightsQuantity } from "../../../stockmarket-shared/src/engine/npcRights";
import { readEngine, runEngine } from "../engine";
import type { MutationCtx as MutationContext } from "../_generated/server";
import type { Doc as Document_ } from "../_generated/dataModel";
export function advanceNpcRights(context: MutationContext, game: Document_<"games">,
    purchase: (context: MutationContext, game: Document_<"games">, quantity: number) => Promise<Document_<"games">>)
{
    return runEngine(context, (runtime) => advance(runtime, game,
        (_runtime, current, quantity) => purchase(context, current, quantity)));
}

export const run = internalMutation({
    args: { gameId: v.id("games"), insightId: v.id("playerInsights"), index: v.number() },
    handler: async (context, { gameId, insightId, index }) =>
    {
        const game = await context.db.get(gameId);
        const issue = game?.rightsIssue;
        if (!game || game.status !== "playing" || !issue || issue.completed
          || issue.insightId !== insightId || issue.index !== index
          || issue.period !== game.currentPeriod || issue.turn !== game.turn)
        {
            return;
        }

        const offer = issue.offers[index];
        const player = await context.db.get(offer.playerId);
        if (player?.controller?.kind !== "npc")
        {
            return;
        }

        const quantity = await npcRightsQuantity(readEngine(context), game, issue, player);

        await advanceNpcRights(context, await purchase(context, game, quantity), purchase);
    },
});
