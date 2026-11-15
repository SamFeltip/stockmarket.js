import type { MutationCtx as MutationContext } from "../_generated/server";
import type { Doc as Document_, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { members } from "../library";
import { isCurrent, isNpc } from "../game/seats";
import { actionAnimationMs } from "../../shared/presentation";
import { random } from "../../../stockmarket-shared/src/shared/random";

async function currentSeat(context: MutationContext, game: Document_<"games"> | null)
{
    if (game?.status !== "playing" || game.rightsIssue)
    {
        return;
    }

    if (game.currentPlayerId)
    {
        const seat = await context.db.get(game.currentPlayerId);

        return seat?.gameId === game._id ? seat : undefined;
    }

    return (await members(context, game._id)).find((seat) => isCurrent(game, seat));
}

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
    const current = await currentSeat(context, game);
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
    const pace = presentationRandom();
    const thinkingDelay = game.pack === "frantic" ? 200 + pace * 300 : 800 + pace * 1000;
    const delay = actionAnimationMs + Math.round(thinkingDelay);
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
