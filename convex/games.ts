import { maximumPlayers, validGameLength } from "../shared/rules";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { currentUser, fail, gameByCode, member, members, normalizeCode } from "./library";

import { phoneHost, spectatorHost } from "./game/hosting";
import { launchGame } from "./launch";
import { packStartingCash } from "../../stockmarket-shared/src/engine/packRules";
import { packValidator } from "./schema";
import { changeLobbyPack, openingMarket } from "./packSettings";

export const create = mutation({
    args: { code: v.string(), periodCount: v.number(),
        spectate: v.optional(v.boolean()), pack: v.optional(packValidator) },
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

        const market = await openingMarket(context, arguments_.pack, arguments_.periodCount);
        const gameId = await context.db.insert("games", {
            code, hostId: user._id, spectatorHostId: arguments_.spectate ? user._id : undefined,
            currentUserId: user._id, ...market,
            currentPeriod: 0, turn: 0, status: "waiting", suspended: [],
            rulesVersion: 2, npcDifficulty: "medium", rosterRevision: 0,
        });
        if (arguments_.spectate)
        {
            return code;
        }

        const playerId = await context.db.insert("players", {
            gameId, userId: user._id, controller: { kind: "human", userId: user._id }, seatOrder: 0, active: true, cash: packStartingCash(arguments_.pack),
            holdings: market.prices.map((price) => ({ stockKey: price.stockKey, quantity: 0 })),
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
        const displayHost = spectatorHost(game, players);
        if (displayHost && !game.spectatorHostId)
        {
            await context.db.patch(game._id, { spectatorHostId: displayHost });
        }

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
            cash: packStartingCash(game.pack), active: true,
            holdings: game.prices.map((price) => ({ stockKey: price.stockKey, quantity: 0 })),
        });
        // Displays own no seats. The first human gets the normal phone lobby controls.
        if (!players.some((seat) => seat.userId) && (game.tvTokenHash || displayHost))
        {
            await context.db.patch(game._id, { hostId: user._id, spectatorHostId: displayHost,
                currentUserId: user._id, currentPlayerId: playerId });
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
            const displayHost = spectatorHost(game, await members(context, game._id));

            await context.db.delete(player._id);
            const remaining = await members(context, game._id);
            const humans = remaining.filter((seat) => seat.controller?.kind !== "npc" && seat.userId);
            if (humans.length === 0 && !displayHost)
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
            else if (humans.length === 0 && displayHost)
            {
                await context.db.patch(game._id, { hostId: displayHost, spectatorHostId: displayHost,
                    currentUserId: undefined, currentPlayerId: undefined });
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
        const user = await currentUser(context);
        const game = await gameByCode(context, code);
        const seats = await members(context, game._id);
        const displayHost = spectatorHost(game, seats);
        if ((phoneHost(game, seats) !== user._id && displayHost !== user._id) || game.status !== "waiting")
        {
            fail("Only the lobby host can change game length");
        }

        if (game.pack === "tech" || !validGameLength(periodCount))
        {
            fail("Invalid game length");
        }

        await context.db.patch(game._id, { periodCount });
    },
});

export const setPack = mutation({
    args: { code: v.string(), pack: packValidator },
    handler: async (context, { code, pack }) =>
    {
        const user = await currentUser(context);
        const game = await gameByCode(context, code);
        const seats = await members(context, game._id);
        if ((phoneHost(game, seats) !== user._id && spectatorHost(game, seats) !== user._id)
          || game.status !== "waiting")
        {
            fail("Only the lobby host can change the stock pack");
        }

        await changeLobbyPack(context, game, seats, pack);
    },
});

export const start = mutation({
    args: { code: v.string() },
    handler: async (context, { code }) =>
    {
        const user = await currentUser(context);
        const game = await gameByCode(context, code);
        const seats = await members(context, game._id);
        const displayHost = spectatorHost(game, seats);
        if (phoneHost(game, seats) !== user._id && displayHost !== user._id)
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
