import type { MutationCtx as MutationContext } from "../_generated/server";
import type { Doc as Document_ } from "../_generated/dataModel";
import type { Decision, NpcMemory } from "../../packages/game-contracts/src";
import { emptyMemory } from "../../packages/npc-engine/src/memory";
export async function loadMemory(
    context: MutationContext,
    playerId: Document_<"players">["_id"],
): Promise<NpcMemory>
{
    const state = await context.db
        .query("npcStates")
        .withIndex("by_player", (q) => q.eq("playerId", playerId))
        .unique();
    if (!state)
    {
        return emptyMemory();
    }

    if (state.version !== 1)
    {
        throw new Error("Unsupported NPC memory version");
    }

    return JSON.parse(state.memory) as NpcMemory;
}

export async function saveAcceptedDecision(
    context: MutationContext,
    pending: Document_<"npcTurns">,
    decision: Decision,
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
        memory: JSON.stringify(decision.nextMemory),
        version: 1,
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
        engineVersion: 1,
    });
}
