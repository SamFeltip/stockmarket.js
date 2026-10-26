import { maximumPlayers, startingCash, validGameLength } from "../shared/rules";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { currentUser, fail, gameByCode, member, members, normalizeCode, seedCatalog } from "./library";

import { launchGame } from "./launch";

export const create = mutation({
    args: { code: v.string(), periodCount: v.number(), spectate: v.optional(v.boolean()) },
    handler: async (context, arguments_) =>
    {
        const user = await currentUser(context);
        const code = normalizeCode(arguments_.code);
        if (!validGameLength(arguments_.periodCount))
        {
            fail("Invalid game length");
        }

        if (await context.db.query("games").withIndex("by_code", (q) => q.eq("code", code)).unique())
        {
            fail("Lobby code already exists");
        }

        await seedCatalog(context);
        const stocks = await context.db.query("stocks").collect();
        const prices = stocks.map((stock) => ({ stockKey: stock.key, value: stock.startingValue }));
        const gameId = await context.db.insert("games", {
            code, hostId: user._id, currentUserId: user._id, periodCount: arguments_.periodCount,
            currentPeriod: 0, turn: 0, status: "waiting", suspended: [],
            rulesVersion: 2, npcDifficulty: "medium", rosterRevision: 0,
            prices, priceHistory: [{ period: 0, prices }],
        });
        if (arguments_.spectate)
        {
            return code;
        }

        const playerId = await context.db.insert("players", {
            gameId, userId: user._id, controller: { kind: "human", userId: user._id }, seatOrder: 0, active: true, cash: startingCash,
            holdings: stocks.map((stock) => ({ stockKey: stock.key, quantity: 0 })),
        });

        await context.db.patch(gameId, { currentPlayerId: playerId });

        return code;
    },
});

export const join = mutation({
    args: { code: v.string() },
    handler: async (context, { code }) =>
    {
        const user = await currentUser(context);
        const game = await gameByCode(context, code);
        const players = await members(context, game._id);
        const existing = players.find((player) => player.userId === user._id);
        if (existing)
        {
            await context.db.patch(existing._id, { active: true });

            return game.code;
        }

        if (game.status !== "waiting")
        {
            fail("This game has already started");
        }

        if (players.length >= maximumPlayers)
        {
            fail("This lobby is full");
        }

        const playerId = await context.db.insert("players", {
            gameId: game._id, userId: user._id, controller: { kind: "human", userId: user._id },
            seatOrder: Math.max(-1, ...players.map((seat, index) => seat.seatOrder ?? index)) + 1,
            cash: startingCash, active: true,
            holdings: game.prices.map((price) => ({ stockKey: price.stockKey, quantity: 0 })),
        });
        // A TV owns no seat: the first human joining becomes the phone host.
        if (players.length === 0 && game.tvTokenHash)
        {
            await context.db.patch(game._id, { hostId: user._id, currentUserId: user._id,
                currentPlayerId: playerId });
        }

        return game.code;
    },
});

export const leave = mutation({
    args: { code: v.string() },
    handler: async (context, { code }) =>
    {
        const { game, player } = await member(context, code);
        // During play retain a seat for reconnection; leaving cannot strand the turn rotation.
        if (game.status === "waiting")
        {
            await context.db.delete(player._id);
            const remaining = await members(context, game._id);
            const humans = remaining.filter((seat) => seat.controller?.kind !== "npc" && seat.userId);
            const spectatorHost = game.hostId !== player.userId
              && !remaining.some((seat) => seat.userId === game.hostId);
            if (humans.length === 0 && !spectatorHost)
            {
                for (const seat of remaining)
                {
                    await context.db.delete(seat._id);
                }

                for (const table of ["npcGameConfigs", "npcStates", "npcTurns", "gameCatalogs"] as const)
                {
                    for (const item of await context.db.query(table).withIndex("by_game", (q) => q.eq("gameId", game._id)).collect())
                    {
                        await context.db.delete(item._id);
                    }
                }

                await context.db.delete(game._id);
            }
            else if (game.hostId === player.userId)
            {
                await context.db.patch(game._id, { hostId: humans[0].userId!, currentUserId: humans[0].userId,
                    currentPlayerId: humans[0]._id, rosterRevision: (game.rosterRevision ?? 0) + 1 });
            }
        }
    },
});

export const setLength = mutation({
    args: { code: v.string(), periodCount: v.number() },
    handler: async (context, { code, periodCount }) =>
    {
        const { game, user } = await member(context, code);
        if (game.hostId !== user._id || game.status !== "waiting")
        {
            fail("Only the lobby host can change game length");
        }

        if (!validGameLength(periodCount))
        {
            fail("Invalid game length");
        }

        await context.db.patch(game._id, { periodCount });
    },
});

export const start = mutation({
    args: { code: v.string() },
    handler: async (context, { code }) =>
    {
        const user = await currentUser(context);
        const game = await gameByCode(context, code);
        if (game.hostId !== user._id)
        {
            fail("Only the lobby host can launch the game");
        }

        await launchGame(context, game);
    },
});

export const list = query({
    args: {},
    handler: async (context) =>
    {
        const user = await currentUser(context);
        const seats = await context.db.query("players").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
        const games = await Promise.all(seats.map((seat) => context.db.get(seat.gameId)));

        return games.filter((game) => game !== null);
    },
});
