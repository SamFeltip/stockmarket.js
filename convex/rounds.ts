import * as engine from "../../stockmarket-shared/src/engine/rounds";
import { displayGameStocks, revealInsights } from "../../stockmarket-shared/src/engine/packRules";
import { pendingSuspensions } from "../shared/suspensions";
import { revealGroups } from "../shared/reveals";
import { readEngine, runEngine } from "./engine";
import type { MutationCtx as MutationContext } from "./_generated/server";
import type { Doc as Document_ } from "./_generated/dataModel";
import { advanceNpcSuspensions } from "./npc/suspensions";
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

        await runEngine(context, (runtime) => engine.holdStock(runtime, game, player, insightId, stockKey));
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

// As with nextSpectator, public displays can move the round presentation.
export const moveReveal = mutation({
    args: { code: v.string(), expectedPeriod: v.number(), step: v.number(), summary: v.boolean() },
    handler: async (context, { code, expectedPeriod, step, summary }) =>
    {
        const game = await gameByCode(context, code);

        checkSuspensionPhase(game, expectedPeriod);
        const previous = game.revealProgress ?? { step: 0, summary: false };
        if (game.suspensionPeriod === expectedPeriod || step < previous.step
          || (step === previous.step && (!summary || previous.summary)))
        {
            return;
        }

        const [stocks, players, cards] = await Promise.all([
            displayGameStocks(readEngine(context), game), members(context, game._id), roundInsights(context, game),
        ]);
        const groups = revealGroups(stocks, revealInsights(game, cards, players, stocks));
        if (!Number.isInteger(step) || step > groups.length || step > previous.step + 1
          || (summary && (step !== previous.step || step === groups.length)))
        {
            fail("Invalid reveal step");
        }

        const hold = groups[previous.step];
        if (hold?.name === "Hold Stock Price" && cards.some((card) => card.stockKey === hold.key && !card.resolved))
        {
            fail("Wait for players to resolve their hold-stock insights");
        }

        const revealProgress = { step, summary };

        await context.db.patch(game._id, { revealProgress });

        if (step === groups.length && pendingSuspensions(expectedPeriod, players, cards).length > 0)
        {
            await openSuspensions(context, game);
        }
    },
});

async function openSuspensions(context: MutationContext, game: Document_<"games">)
{
    const suspensionPeriod = game.currentPeriod;

    await context.db.patch(game._id, { suspensionPeriod });
    await advanceNpcSuspensions(context, { ...game, suspensionPeriod });
}

// Older clients can still open the shared suspension phase.
export const beginSuspensions = mutation({
    args: { code: v.string(), expectedPeriod: v.number() },
    handler: async (context, { code, expectedPeriod }) =>
    {
        const game = await gameByCode(context, code);

        checkSuspensionPhase(game, expectedPeriod);

        if (game.suspensionPeriod !== game.currentPeriod)
        {
            await openSuspensions(context, game);
        }
    },
});

export const suspendShare = mutation({
    args: { code: v.string(), expectedPeriod: v.number(),
        insightId: v.id("playerInsights"), stockKey: v.optional(v.number()), playerIds: v.optional(v.array(v.id("players"))) },
    handler: async (context, { code, expectedPeriod, insightId, stockKey, playerIds }) =>
    {
        const { game, player } = await member(context, code);

        checkSuspensionPhase(game, expectedPeriod);
        const updated = await spendSuspension(context, game, insightId, stockKey, playerIds, player._id);

        await advanceNpcSuspensions(context, updated);
    },
});

// Like nextSpectator, the public display acts on behalf of a player who cannot continue.
export const skipSuspension = mutation({
    args: { code: v.string(), expectedPeriod: v.number(), insightId: v.id("playerInsights") },
    handler: async (context, { code, expectedPeriod, insightId }) =>
    {
        const game = await gameByCode(context, code);

        checkSuspensionPhase(game, expectedPeriod);
        const updated = await spendSuspension(context, game, insightId);

        await advanceNpcSuspensions(context, updated);
    },
});
