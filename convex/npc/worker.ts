import type { Id } from "../_generated/dataModel";
import { activateRightsIssue } from "../rightsIssue";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import type { NpcTurnDecision } from "../../../stockmarket-shared/src/npc";
import { buildNpcTurnInput, decideNpcTurn, fallbackNpcTurn, prepareNpcState } from "../../../stockmarket-shared/src/npc";
import { readEngine } from "../engine";
import { applyTurn } from "../game/commands";
import { isCurrent } from "../game/seats";
import { publicIdentity } from "./identity";
import { enqueueNextNpcIfNeeded } from "./scheduling";
import { loadState, saveAcceptedDecision } from "./persistence";
export const run = internalMutation({
    args: { pendingId: v.id("npcTurns"), generation: v.string() },
    handler: async (context, { pendingId, generation }): Promise<void> =>
    {
        const pending = await context.db.get(pendingId);
        if (!pending || pending.generation !== generation)
        {
            return;
        }

        const game = await context.db.get(pending.gameId);
        const seat = await context.db.get(pending.playerId);
        if (
            !game
            || (game.status !== "playing" || game.rightsIssue)
            || game.currentPeriod !== pending.period
            || game.turn !== pending.turn
            || !seat
            || seat.gameId !== game._id
            || !isCurrent(game, seat)
            || seat.controller?.kind !== "npc"
        )
        {
            await context.db.delete(pendingId);

            return;
        }

        const state = prepareNpcState(
            pending.attempts >= 3 ? null : await loadState(context, seat._id),
        );
        const config = await context.db
            .query("npcGameConfigs")
            .withIndex("by_game", (q) => q.eq("gameId", game._id))
            .unique();
        const started = Date.now();
        let decision: NpcTurnDecision = fallbackNpcTurn(state);
        let diagnostic: string | undefined = pending.lastError
            ? `Recovered after: ${pending.lastError}`
            : undefined;
        if (pending.attempts >= 3)
        {
            diagnostic = "Recovery fallback after repeated overdue attempts";
        }
        else
        {
            const input = await buildNpcTurnInput(readEngine(context), game, seat);

            // Catch engine failures only; database, observation and command failures roll back the transaction.
            try
            {
                decision = decideNpcTurn(input, state, pending.seed, config);
                diagnostic = decision.diagnostic ?? diagnostic;
            }
            catch (error)
            {
                const message = error instanceof Error ? error.message : "Decision failed";
                if (pending.attempts < 2)
                {
                    await context.db.patch(pendingId, {
                        attempts: pending.attempts + 1,
                        lastError: message,
                        due: Date.now() + 500,
                    });
                    await context.scheduler.runAfter(500, internal.npc.worker.run, {
                        pendingId,
                        generation,
                    });

                    return;
                }

                diagnostic = `Decision failed after repeated attempts: ${message}`;
                decision = fallbackNpcTurn(state);
            }
        }

        const action = decision.action;
        const display = await publicIdentity(context, seat);
        const command = { playerId: seat._id, expectedPeriod: pending.period, expectedTurn: pending.turn };
        if (action.kind === "rights-issue")
        {
            await activateRightsIssue(context, game, seat, display,
                { ...command, ...action, insightId: action.insightId as Id<"playerInsights"> });
        }
        else
        {
            const accepted = action.kind === "government-loan" || action.kind === "debenture"
                ? { ...action, insightId: action.insightId as Id<"playerInsights"> } : action;

            await applyTurn(context, { ...command, action: accepted }, display);
        }

        await saveAcceptedDecision(context, pending, decision, Date.now() - started, diagnostic);

        if (await context.db.get(pendingId))
        {
            await context.db.delete(pendingId);
        }

        await enqueueNextNpcIfNeeded(context, game._id);
    },
});
