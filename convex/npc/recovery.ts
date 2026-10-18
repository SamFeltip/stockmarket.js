import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
export const sweep = internalMutation({
    args: {},
    handler: async (context): Promise<void> =>
    {
        const overdue = await context.db
            .query("npcTurns")
            .withIndex("by_due", (q) => q.lt("due", Date.now() - 30_000))
            .take(32);
        for (const pending of overdue)
        {
            const game = await context.db.get(pending.gameId);
            if (
                !game
                || game.status !== "playing"
                || game.currentPlayerId !== pending.playerId
                || game.currentPeriod !== pending.period
                || game.turn !== pending.turn
            )
            {
                await context.db.delete(pending._id);
                continue;
            }

            // Preserve generation and seed: concurrent original/recovery deliveries can commit only once.
            await context.db.patch(pending._id, {
                attempts: pending.attempts + 1,
                due: Date.now(),
            });
            await context.scheduler.runAfter(0, internal.npc.worker.run, {
                pendingId: pending._id,
                generation: pending.generation,
            });
        }
    },
});

export const metrics = internalMutation({
    args: {},
    handler: async (context) =>
    {
        const pending = await context.db.query("npcTurns").withIndex("by_due").take(32);
        const traces = await context.db.query("npcTraces").order("desc").take(100);

        return {
            oldestPendingAgeMs:
                pending.length > 0
                    ? Math.max(0, ...pending.map((item) => Date.now() - item.enqueuedAt))
                    : 0,
            pendingSampleSize: pending.length,
            traceSampleSize: traces.length,
            averageExecutionMs:
                traces.reduce((sum, item) => sum + item.elapsedMs, 0) / Math.max(1, traces.length),
            retries: traces.reduce((sum, item) => sum + item.attempts, 0),
            invalidProposals: traces.filter((item) => item.diagnostic === "Invalid proposed action")
                .length,
            fallbackCount: traces.filter(
                (item) => item.diagnostic && !item.diagnostic.startsWith("Recovered after:"),
            ).length,
        };
    },
});
