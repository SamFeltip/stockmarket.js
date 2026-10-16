import { minimumPlayers, startingCash, validGameLength } from "../shared/rules";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { currentUser, deal, fail, feedItem, gameByCode, member, members, normalizeCode, seedCatalog } from "./library";

export const create = mutation({
    args: { code: v.string(), periodCount: v.number() },
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
            prices, priceHistory: [{ period: 0, prices }],
        });

        await context.db.insert("players", {
            gameId, userId: user._id, active: true, cash: startingCash,
            holdings: stocks.map((stock) => ({ stockKey: stock.key, quantity: 0 })),
        });

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

        if (players.length >= 6)
        {
            fail("This lobby is full");
        }

        await context.db.insert("players", {
            gameId: game._id, userId: user._id, cash: startingCash, active: true,
            holdings: game.prices.map((price) => ({ stockKey: price.stockKey, quantity: 0 })),
        });

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
            if (remaining.length === 0)
            {
                await context.db.delete(game._id);
            }
            else if (game.hostId === player.userId)
            {
                await context.db.patch(game._id, { hostId: remaining[0].userId, currentUserId: remaining[0].userId });
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
        const { game, user } = await member(context, code);
        if (game.hostId !== user._id)
        {
            fail("Only the lobby host can launch the game");
        }

        if (game.status !== "waiting")
        {
            fail("The game has already started");
        }

        const players = await members(context, game._id);
        if (players.length < minimumPlayers)
        {
            fail("At least two players are required");
        }

        if (!validGameLength(game.periodCount))
        {
            fail("Invalid game length");
        }

        await deal(context, game, players);
        await context.db.patch(game._id, { status: "playing", currentUserId: players[0].userId });
        await feedItem(context, game, "game started", "game started", "/static/imgs/icons/Handshake.svg", "grey");
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
