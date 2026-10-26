import { v } from "convex/values";
import { mutation } from "../_generated/server";
import type { MutationCtx as MutationContext } from "../_generated/server";
import { currentUser, gameByCode, fail, members } from "../library";
import type { Doc as Document_ } from "../_generated/dataModel";
import { maximumPlayers, minimumPlayers, startingCash } from "../../shared/rules";
import { difficultyValidator } from "../schema";
import { roster } from "../../packages/npc-engine/src/roster";
import { random, shuffled } from "../../packages/npc-engine/src/random";
import { engineVersion, tuningVersion } from "../../packages/npc-engine/src/difficulty";
import { phoneHost, spectatorHost } from "../game/hosting";
import { emptyMemory } from "../../packages/npc-engine/src/memory";

async function hostLobby(context: MutationContext, code: string)
{
    const user = await currentUser(context);
    const game = await gameByCode(context, code);
    const seats = await members(context, game._id);
    const displayHost = spectatorHost(game, seats);
    if ((phoneHost(game, seats) !== user._id && displayHost !== user._id) || game.status !== "waiting")
    {
        fail("Only the lobby host can configure NPCs while waiting");
    }

    return { game, user };
}

async function addSeats(
    context: MutationContext,
    game: Document_<"games">,
    count: number,
): Promise<void>
{
    if (process.env.NPC_DISABLE_NEW_GAMES === "true")
    {
        fail("New NPC games are temporarily unavailable");
    }

    const players = await members(context, game._id);
    if (players.length + count > maximumPlayers)
    {
        fail("This lobby is full");
    }

    let config = await context.db
        .query("npcGameConfigs")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .unique();
    if (!config)
    {
        const rosterSeed = `roster:${Math.random()}`;
        const configId = await context.db.insert("npcGameConfigs", {
            gameId: game._id,
            rosterSeed,
            queue: shuffled(
                roster.map((entry) => entry.id),
                random(rosterSeed),
            ),
            engineVersion,
            tuningVersion,
        });

        config = (await context.db.get(configId))!;
    }

    const queue = [...config.queue];
    let seatOrder = Math.max(-1, ...players.map((seat, index) => seat.seatOrder ?? index)) + 1;
    for (let index = 0; index < count; index++)
    {
        const personality = queue.shift() ?? fail("No NPC personalities available");
        const playerId = await context.db.insert("players", {
            gameId: game._id,
            controller: { kind: "npc", personality },
            npcDifficulty: game.npcDifficulty ?? "medium",
            seatOrder: seatOrder++,
            cash: startingCash,
            active: true,
            holdings: game.prices.map((price) => ({ stockKey: price.stockKey, quantity: 0 })),
        });

        await context.db.insert("npcStates", {
            gameId: game._id,
            playerId,
            memory: JSON.stringify(emptyMemory()),
            version: 1,
        });
    }

    await context.db.patch(config._id, { queue });
    await context.db.patch(game._id, {
        rosterRevision: (game.rosterRevision ?? 0) + 1,
        npcDifficulty: game.npcDifficulty ?? "medium",
    });
}

export const add = mutation({
    args: { code: v.string(), required: v.optional(v.boolean()) },
    handler: async (context, { code, required }) =>
    {
        const { game } = await hostLobby(context, code);
        const count = required
            ? Math.max(0, minimumPlayers - (await members(context, game._id)).length)
            : 1;
        if (count)
        {
            await addSeats(context, game, count);
        }
    },
});

export const remove = mutation({
    args: { code: v.string(), playerId: v.id("players") },
    handler: async (context, { code, playerId }) =>
    {
        const { game } = await hostLobby(context, code);
        const player = await context.db.get(playerId);
        if (player?.gameId !== game._id || player.controller?.kind !== "npc")
        {
            fail("Choose an NPC in this lobby");
        }

        const config = (await context.db
            .query("npcGameConfigs")
            .withIndex("by_game", (q) => q.eq("gameId", game._id))
            .unique())!;

        await context.db.patch(config._id, {
            queue: [...config.queue, player.controller.personality],
        });
        const state = await context.db
            .query("npcStates")
            .withIndex("by_player", (q) => q.eq("playerId", playerId))
            .unique();
        if (state)
        {
            await context.db.delete(state._id);
        }

        await context.db.delete(playerId);
        await context.db.patch(game._id, { rosterRevision: (game.rosterRevision ?? 0) + 1 });
    },
});

export const setDifficulty = mutation({
    args: {
        code: v.string(),
        difficulty: difficultyValidator,
        playerId: v.optional(v.id("players")),
    },
    handler: async (context, { code, difficulty, playerId }) =>
    {
        const { game } = await hostLobby(context, code);
        if (playerId)
        {
            const player = await context.db.get(playerId);
            if (player?.gameId !== game._id || player.controller?.kind !== "npc")
            {
                fail("Choose an NPC in this lobby");
            }

            await context.db.patch(playerId, { npcDifficulty: difficulty });

            return;
        }

        // Keep the former game-wide endpoint compatible with existing clients and fixtures.
        await context.db.patch(game._id, { npcDifficulty: difficulty });

        for (const player of await members(context, game._id))
        {
            if (player.controller?.kind === "npc")
            {
                await context.db.patch(player._id, { npcDifficulty: difficulty });
            }
        }
    },
});
