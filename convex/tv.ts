import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { fail, gameByCode, members, netWorth, normalizeCode, roundInsights, seedCatalog } from "./library";
import { publicIdentity } from "./npc/identity";
import { launchGame } from "./launch";
import { advancePeriod } from "./advancePeriod";
import { validGameLength } from "../shared/rules";

async function tokenHash(token: string)
{
    if (!/^[a-f0-9]{64}$/.test(token))
    {
        fail("Invalid TV control token");
    }

    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));

    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// A device is never a player. Its capability authorizes lobby launch only.
export const create = mutation({
    args: { code: v.string(), periodCount: v.number(), token: v.string() },
    handler: async (context, arguments_) =>
    {
        const code = normalizeCode(arguments_.code);
        const hash = await tokenHash(arguments_.token);
        if (!validGameLength(arguments_.periodCount))
        {
            fail("Invalid game length");
        }

        const existing = await context.db.query("games").withIndex("by_code", (q) => q.eq("code", code)).unique();
        if (existing)
        {
            if (existing.tvTokenHash === hash)
            {
                return code;
            }

            fail("Lobby code already exists; choose another code");
        }

        await seedCatalog(context);
        const stocks = await context.db.query("stocks").collect();
        const prices = stocks.map((stock) => ({ stockKey: stock.key, value: stock.startingValue }));

        await context.db.insert("games", {
            code, tvTokenHash: hash, periodCount: arguments_.periodCount, currentPeriod: 0,
            turn: 0, status: "waiting", suspended: [], prices, priceHistory: [{ period: 0, prices }],
            rulesVersion: 2, npcDifficulty: "medium", rosterRevision: 0,
        });

        return code;
    },
});

export const start = mutation({
    args: { code: v.string(), token: v.string() },
    handler: async (context, { code, token }) =>
    {
        const game = await gameByCode(context, code);
        if (!game.tvTokenHash || await tokenHash(token) !== game.tvTokenHash)
        {
            fail("Only the TV that created this lobby can launch it");
        }

        await launchGame(context, game);
    },
});

export const next = mutation({
    args: { code: v.string(), token: v.string(), expectedPeriod: v.number() },
    handler: async (context, { code, token, expectedPeriod }) =>
    {
        const game = await gameByCode(context, code);
        if (!game.tvTokenHash || await tokenHash(token) !== game.tvTokenHash)
        {
            fail("Only the controlling TV can advance the round");
        }

        await advancePeriod(context, game, expectedPeriod);
    },
});

// Explicit allowlist: insight cards become public only after trading closes.
// Never return a raw game, account, capability, or an open-period insight.
export const board = query({
    args: { code: v.string() },
    handler: async (context, { code }) =>
    {
        const normalized = normalizeCode(code);
        const game = await context.db.query("games").withIndex("by_code", (q) => q.eq("code", normalized)).unique();
        if (!game)
        {
            return null;
        }

        const seats = await members(context, game._id);
        const catalog = (await context.db.query("stocks").collect()).toSorted((a, b) => a.variation - b.variation);
        const stocks = catalog.filter((stock) => stock.display);
        const canReveal = game.status === "closed" || game.status === "special_insights";
        const revealed = canReveal ? await roundInsights(context, game) : [];
        const reveal = canReveal ? {
            period: game.currentPeriod,
            prices: game.prices.map((price) => ({ stockKey: price.stockKey, value: price.value })),
            suspended: game.suspended,
            stocks: catalog.map((stock) => ({ key: stock.key, name: stock.name, display: stock.display,
                imagePath: stock.imagePath, secondaryImagePath: stock.secondaryImagePath })),
            insights: revealed.map((insight) => ({ _id: insight._id, playerId: insight.playerId,
                stockKey: insight.stockKey, value: insight.value, description: insight.description,
                resolved: insight.resolved })),
        } : null;
        const players = await Promise.all(seats.map(async (seat) =>
        {
            const display = await publicIdentity(context, seat);

            return {
                id: seat._id, name: display.name, profileRoot: display.profileRoot,
                cash: seat.cash, holdings: seat.holdings.filter((holding) =>
                    stocks.some((stock) => stock.key === holding.stockKey)), netWorth: netWorth(seat, game),
            };
        }));
        const feed = await context.db.query("feed").withIndex("by_game", (q) => q.eq("gameId", game._id))
            .order("desc").take(24);
        const purchase = await context.db.query("feed").withIndex("by_game", (q) => q.eq("gameId", game._id))
            .filter((q) => q.gt(q.field("quantity"), 0)).order("desc").first();

        return {
            reveal,
            latestPurchase: purchase ? { title: purchase.title, message: purchase.message } : null,
            game: { code: game.code, status: game.status, currentPeriod: game.currentPeriod,
                tvControlled: Boolean(game.tvTokenHash),
                periodCount: game.periodCount, turn: game.turn,
                currentPlayerId: game.currentPlayerId
                  ?? seats.find((seat) => seat.userId === game.currentUserId)?._id },
            stocks: stocks.map((stock) => ({ key: stock.key, name: stock.name, imagePath: stock.imagePath,
                startingValue: stock.startingValue,
                value: game.prices.find((price) => price.stockKey === stock.key)?.value ?? stock.startingValue,
                held: players.reduce((sum, player) => sum + (player.holdings.find((holding) =>
                    holding.stockKey === stock.key)?.quantity ?? 0), 0) })),
            history: (game.priceHistory ?? []).map((entry) => ({ period: entry.period,
                prices: entry.prices.filter((price) => stocks.some((stock) => stock.key === price.stockKey)) })),
            players,
            feed: feed.map((item) => ({ id: item._id, at: item._creationTime, period: item.period,
                title: item.title, message: item.message, imageRoot: item.imageRoot, colour: item.colour,
                stockKey: item.stockKey, quantity: item.quantity })),
        };
    },
});
