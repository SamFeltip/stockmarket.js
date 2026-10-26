import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { currentUser, gameByCode, fail, member } from "./library";

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
