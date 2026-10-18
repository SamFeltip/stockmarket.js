import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import type { Decision } from "../../packages/game-contracts/src";
import { decide, emptyMemory, engineVersion, isLegalProposal } from "../../packages/npc-engine/src";
import { buildNpcObservation } from "./observation";
import { applyTurn } from "../game/commands";
import { isCurrent } from "../game/seats";
import { publicIdentity } from "./identity";
import { enqueueNextNpcIfNeeded } from "./scheduling";
import { loadMemory, saveAcceptedDecision } from "./persistence";
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
            || game.status !== "playing"
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

        const memory = pending.attempts >= 3 ? emptyMemory() : await loadMemory(context, seat._id);
        const config = await context.db
            .query("npcGameConfigs")
            .withIndex("by_game", (q) => q.eq("gameId", game._id))
            .unique();
        const started = Date.now();
        let decision: Decision = {
            action: { kind: "pass" },
            nextMemory: memory,
            reason: "retain-cash",
        };
        let diagnostic: string | undefined = pending.lastError
            ? `Recovered after: ${pending.lastError}`
            : undefined;
        if (pending.attempts >= 3)
        {
            diagnostic = "Recovery fallback after repeated overdue attempts";
        }
        else
        {
            const observation = await buildNpcObservation(context, game, seat);

            // Catch engine failures only; database, observation and command failures roll back the transaction.
            try
            {
                if (config?.engineVersion !== engineVersion || config.tuningVersion !== 1)
                {
                    throw new Error("Unsupported pinned engine version");
                }

                decision = decide(
                    observation,
                    {
                        personality: seat.controller.personality,
                        difficulty: seat.npcDifficulty ?? game.npcDifficulty ?? "medium",
                    },
                    memory,
                    pending.seed,
                );

                if (!isLegalProposal(decision.action, observation.legalActions))
                {
                    diagnostic = "Invalid proposed action";
                    decision = {
                        action: { kind: "pass" },
                        nextMemory: memory,
                        reason: "retain-cash",
                    };
                }
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
                decision = { action: { kind: "pass" }, nextMemory: memory, reason: "retain-cash" };
            }
        }

        await applyTurn(
            context,
            {
                playerId: seat._id,
                expectedPeriod: pending.period,
                expectedTurn: pending.turn,
                action: decision.action,
            },
            await publicIdentity(context, seat),
        );
        await saveAcceptedDecision(context, pending, decision, Date.now() - started, diagnostic);
        await context.db.delete(pendingId);
        await enqueueNextNpcIfNeeded(context, game._id);
    },
});
