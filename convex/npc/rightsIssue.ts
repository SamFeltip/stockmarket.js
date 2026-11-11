import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { purchase } from "../rightsIssue";
import { members } from "../library";
import { rightsAvailable, rightsPriceFor } from "../../shared/rights-issue";
import { chooseNpcAction } from "../../../stockmarket-shared/src/npc";

import { advanceNpcRights as advance } from "../../../stockmarket-shared/src/engine/npcRights";
import { runEngine } from "../engine";
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

        const price = game.prices.find((item) => item.stockKey === issue.stockKey)?.value ?? 0;
        const available = rightsAvailable(await members(context, gameId), issue.stockKey);
        const { action } = chooseNpcAction({ phase: "rights", price, maximum: offer.maximum,
            cash: player.cash, available, issuePrice: rightsPriceFor(game.pack, price) });

        await advanceNpcRights(context, await purchase(context, game, action.quantity), purchase);
    },
});
