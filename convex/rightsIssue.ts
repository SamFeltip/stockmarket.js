import * as engine from "../../stockmarket-shared/src/engine/rightsIssue";
import { runEngine, type Arguments } from "./engine";
import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import type { MutationCtx as MutationContext } from "./_generated/server";
import { member, gameByCode, fail } from "./library";
import { enqueueNextNpcIfNeeded } from "./npc/scheduling";
import { advanceNpcRights } from "./npc/rightsIssue";

export const activate = mutation({
    args: { code: v.string(), expectedPeriod: v.number(), expectedTurn: v.number(),
        insightId: v.id("playerInsights"), stockKey: v.number() },
    handler: async (context, arguments_) =>
    {
        const { game, player, user } = await member(context, arguments_.code);

        await activateRightsIssue(context, game, player, user, arguments_);
    },
});

export function activateRightsIssue(context: MutationContext,
    ...arguments_: Arguments<typeof engine.activateRightsIssue>)
{
    return runEngine(context, (runtime) => engine.activateRightsIssue(runtime, ...arguments_));
}

const decisionArguments = { code: v.string(), insightId: v.id("playerInsights"), expectedIndex: v.number() };

function currentOffer(...arguments_: Parameters<typeof engine.currentOffer>)
{
    try
    {
        return engine.currentOffer(...arguments_);
    }
    catch (error)
    {
        if (error instanceof Error)
        {
            fail(error.message);
        }

        throw error;
    }
}

export const decide = mutation({
    args: { ...decisionArguments, quantity: v.number() },
    handler: async (context, arguments_) =>
    {
        const { game, player } = await member(context, arguments_.code);
        const issue = currentOffer(game, arguments_.insightId, arguments_.expectedIndex);
        if (issue.offers[issue.index]?.playerId !== player._id)
        {
            fail("Wait for your Rights Issue choice");
        }

        await advanceNpcRights(context, await purchase(context, game, arguments_.quantity), purchase);
        await enqueueNextNpcIfNeeded(context, game._id);
    },
});

// As with suspension decisions, a public spectator can skip the current offer, never purchase for a player.
export const skip = mutation({
    args: decisionArguments,
    handler: async (context, arguments_) =>
    {
        const game = await gameByCode(context, arguments_.code);

        currentOffer(game, arguments_.insightId, arguments_.expectedIndex);
        await advanceNpcRights(context, await purchase(context, game, 0), purchase);
        await enqueueNextNpcIfNeeded(context, game._id);
    },
});

export function purchase(context: MutationContext,
    ...arguments_: Arguments<typeof engine.purchase>)
{
    return runEngine(context, (runtime) => engine.purchase(runtime, ...arguments_));
}

export const finish = internalMutation({
    args: { gameId: v.id("games"), insightId: v.id("playerInsights") },
    handler: async (context, { gameId, insightId }) =>
    {
        await runEngine(context, (runtime) => engine.finishRights(runtime, gameId, insightId));
    },
});
