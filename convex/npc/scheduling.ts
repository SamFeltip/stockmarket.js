import type { MutationCtx as MutationContext } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { members } from "../library";
import { isCurrent, isNpc } from "../game/seats";
import { actionAnimationMs } from "../../shared/presentation";
import { random } from "../../packages/npc-engine/src/random";
export async function enqueueNextNpcIfNeeded(
    context: MutationContext,
    gameId: Id<"games">,
): Promise<void>
{
    const game = await context.db.get(gameId);
    const pending = await context.db
        .query("npcTurns")
        .withIndex("by_game", (q) => q.eq("gameId", gameId))
        .unique();
    const seats = game?.status === "playing" ? await members(context, gameId) : [];
    const current = game && seats.find((seat) => isCurrent(game, seat));
    if (
        pending
        && current
        && pending.playerId === current._id
        && pending.period === game?.currentPeriod
        && pending.turn === game.turn
    )
    {
        return;
    }

    if (pending)
    {
        await context.db.delete(pending._id);
    }

    if (!game || !current || !isNpc(current))
    {
        return;
    }

    const generation = `${game.currentPeriod}:${game.turn}:${Math.random()}`;
    const seed = `decision:${Math.random()}`;
    const presentationRandom = random(`${generation}:presentation`);
    const delay = actionAnimationMs + Math.round(800 + presentationRandom() * 1000);
    const pendingId = await context.db.insert("npcTurns", {
        gameId,
        playerId: current._id,
        period: game.currentPeriod,
        turn: game.turn,
        generation,
        seed,
        due: Date.now() + delay,
        enqueuedAt: Date.now(),
        attempts: 0,
    });

    await context.scheduler.runAfter(delay, internal.npc.worker.run, { pendingId, generation });
}
