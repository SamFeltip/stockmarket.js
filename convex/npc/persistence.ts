import type { MutationCtx as MutationContext } from "../_generated/server";
import type { Doc as Document_ } from "../_generated/dataModel";
import type { NpcState, NpcTurnDecision } from "../../../stockmarket-shared/src/npc";
export async function loadState(
    context: MutationContext,
    playerId: Document_<"players">["_id"],
): Promise<NpcState | null>
{
    const state = await context.db
        .query("npcStates")
        .withIndex("by_player", (q) => q.eq("playerId", playerId))
        .unique();

    return state ? { memory: state.memory, version: state.version } : null;
}

export async function saveAcceptedDecision(
    context: MutationContext,
    pending: Document_<"npcTurns">,
    decision: NpcTurnDecision,
    elapsedMs: number,
    diagnostic?: string,
): Promise<void>
{
    const state = await context.db
        .query("npcStates")
        .withIndex("by_player", (q) => q.eq("playerId", pending.playerId))
        .unique();
    const fields = {
        gameId: pending.gameId,
        playerId: pending.playerId,
        ...decision.state,
    };

    await (state ? context.db.patch(state._id, fields) : context.db.insert("npcStates", fields));
    await context.db.insert("npcTraces", {
        gameId: pending.gameId,
        playerId: pending.playerId,
        period: pending.period,
        turn: pending.turn,
        action: decision.action,
        reason: decision.reason,
        elapsedMs,
        diagnostic,
        attempts: pending.attempts,
        engineVersion: decision.engineVersion,
    });
}
