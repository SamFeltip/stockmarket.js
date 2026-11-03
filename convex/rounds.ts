import type { MutationCtx as MutationContext } from "./_generated/server";
import type { Doc as Document_, Id } from "./_generated/dataModel";
import { resolveNpcSuspensions } from "./npc/suspensions";
import { pendingSuspensions } from "../shared/suspensions";
import { checkSuspensionPhase, spendSuspension } from "./suspensions";
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { currentUser, gameByCode, fail, member, members, roundInsights } from "./library";

import { spectatorHost } from "./game/hosting";
import { advancePeriod } from "./advancePeriod";

export const showSpecial = mutation({
    args: { code: v.string() },
    handler: async (context, { code }) =>
    {
        const { game } = await member(context, code);
        if (game.status !== "closed")
        {
            fail("The market must be closed");
        }

        // Compatibility endpoint: reveal progress belongs to each browser, not the shared game.
    },
});

export const hold = mutation({
    args: { code: v.string(), insightId: v.id("playerInsights"), stockKey: v.optional(v.number()) },
    handler: async (context, { code, insightId, stockKey }) =>
    {
        const { game, player } = await member(context, code);
        if (game.status !== "closed" && game.status !== "special_insights")
        {
            fail("Wait for special insights");
        }

        const insight = await context.db.get(insightId);
        if (!insight || insight.gameId !== game._id || insight.period !== game.currentPeriod
          || insight.playerId !== player._id || insight.resolved)
        {
            fail("This insight cannot be used");
        }

        const special = await context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", insight.stockKey)).unique();
        if (special?.name !== "Hold Stock Price")
        {
            fail("This is not a hold-stock insight");
        }

        if (stockKey !== undefined)
        {
            const stock = await context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", stockKey)).unique();
            if (!stock?.display)
            {
                fail("Choose a tradable stock");
            }

            await context.db.patch(game._id, { suspended: [...new Set([...game.suspended, stockKey])] });
        }

        await context.db.patch(insightId, { resolved: true });
    },
});

export const next = mutation({
    args: { code: v.string(), expectedPeriod: v.number() },
    handler: async (context, { code, expectedPeriod }) =>
    {
        const user = await currentUser(context);
        const game = await gameByCode(context, code);
        if (spectatorHost(game, await members(context, game._id)))
        {
            fail("Use the spectator display to start the next period");
        }

        if (game.hostId !== user._id)
        {
            fail("Only the lobby host can advance the round");
        }

        if (game.tvTokenHash)
        {
            fail("Use the TV remote to start the next period");
        }

        await advancePeriod(context, game, expectedPeriod);
    },
});

export const nextSpectator = mutation({
    args: { code: v.string(), expectedPeriod: v.number() },
    handler: async (context, { code, expectedPeriod }) =>
    {
        const game = await gameByCode(context, code);

        // The public spectator display can continue on behalf of the creator.
        // Settlement still checks the period and waits for unresolved hold-stock insights.
        await advancePeriod(context, game, expectedPeriod);
    },
});

// Reveal navigation is per browser; any display reaching the cash summary can open this shared phase.
export const beginSuspensions = mutation({
    args: { code: v.string(), expectedPeriod: v.number() },
    handler: async (context, { code, expectedPeriod }) =>
    {
        const game = await gameByCode(context, code);

        checkSuspensionPhase(game, expectedPeriod);
        await context.db.patch(game._id, { suspensionPeriod: game.currentPeriod });
        await resolveNpcSuspensions(context, game);
    },
});

export const suspendShare = mutation({
    args: { code: v.string(), expectedPeriod: v.number(),
        insightId: v.id("playerInsights"), stockKey: v.optional(v.number()) },
    handler: async (context, { code, expectedPeriod, insightId, stockKey }) =>
    {
        const { game, player } = await member(context, code);

        checkSuspensionPhase(game, expectedPeriod);
        const card = await currentSuspension(context, game, insightId);
        if (card.playerId !== player._id)
        {
            fail("Wait for your Share Suspended card");
        }

        const updated = await spendSuspension(context, game, card, stockKey);

        await resolveNpcSuspensions(context, updated);
    },
});

// Like nextSpectator, the public display acts on behalf of a player who cannot continue.
export const skipSuspension = mutation({
    args: { code: v.string(), expectedPeriod: v.number(), insightId: v.id("playerInsights") },
    handler: async (context, { code, expectedPeriod, insightId }) =>
    {
        const game = await gameByCode(context, code);

        checkSuspensionPhase(game, expectedPeriod);
        const card = await currentSuspension(context, game, insightId);
        const updated = await spendSuspension(context, game, card);

        await resolveNpcSuspensions(context, updated);
    },
});

async function currentSuspension(context: MutationContext, game: Document_<"games">, insightId: Id<"playerInsights">)
{
    if (game.suspensionPeriod !== game.currentPeriod)
    {
        fail("Wait until the stock and cash reveals are complete");
    }

    const players = await members(context, game._id);
    const insights = await roundInsights(context, game);
    const queue = pendingSuspensions(game.currentPeriod, players, insights);
    if (queue[0]?._id !== insightId)
    {
        fail("This Share Suspended decision has already changed");
    }

    return queue[0];
}
