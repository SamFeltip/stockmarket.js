import { companyRoles } from "../shared/company-roles";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { fail, gameByCode, members, tradeHistory, netWorth, normalizeCode, roundInsights } from "./library";
import { publicIdentity } from "./npc/identity";
import { spectatorHost } from "./game/hosting";
import { launchGame } from "./launch";
import { advancePeriod } from "./advancePeriod";

import { displayGameStocks, revealInsights, validPackLength } from "../../stockmarket-shared/src/engine/packRules";
import { readEngine } from "./engine";
import { changeLobbyPack, openingMarket, publicTradingDates, setLobbyLength } from "./packSettings";
import { packValidator } from "./schema";

async function tokenHash(token: string)
{
    if (!/^[a-f0-9]{64}$/.test(token))
    {
        fail("Invalid TV control token");
    }

    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));

    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// A device is never a player. Its capability authorizes TV host actions.
export const create = mutation({
    args: { code: v.string(), periodCount: v.number(), token: v.string(), pack: v.optional(packValidator) },
    handler: async (context, arguments_) =>
    {
        const code = normalizeCode(arguments_.code);
        const hash = await tokenHash(arguments_.token);
        if (!validPackLength(arguments_.pack, arguments_.periodCount))
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

        const market = await openingMarket(context, arguments_.pack, arguments_.periodCount);

        await context.db.insert("games", {
            code, tvTokenHash: hash, ...market, currentPeriod: 0,
            turn: 0, status: "waiting", suspended: [],
            rulesVersion: 2, npcDifficulty: "medium", rosterRevision: 0,
        });

        return code;
    },
});

export const setPack = mutation({
    args: { code: v.string(), token: v.string(), pack: packValidator },
    handler: async (context, { code, token, pack }) =>
    {
        const game = await gameByCode(context, code);
        if (game.status !== "waiting" || !game.tvTokenHash || await tokenHash(token) !== game.tvTokenHash)
        {
            fail("Only the controlling TV can change the stock pack");
        }

        await changeLobbyPack(context, game, await members(context, game._id), pack);
    },
});

export const setLength = mutation({
    args: { code: v.string(), token: v.string(), periodCount: v.number() },
    handler: async (context, { code, token, periodCount }) =>
    {
        const game = await gameByCode(context, code);
        if (game.status !== "waiting" || !game.tvTokenHash || await tokenHash(token) !== game.tvTokenHash)
        {
            fail("Only the controlling TV can change game length");
        }

        await setLobbyLength(context, game, periodCount);
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
        const catalog = await displayGameStocks(readEngine(context), game);
        const stocks = catalog.filter((stock) => stock.display);
        const canReveal = game.status === "closed" || game.status === "special_insights";
        const [revealed, trades] = canReveal
            ? await Promise.all([roundInsights(context, game), tradeHistory(context, game._id, seats.length)])
            : [[], []];
        const reveal = canReveal ? {
            period: game.currentPeriod, trades,
            prices: game.prices.map((price) => ({ stockKey: price.stockKey, value: price.value })),
            suspended: game.suspended,
            suspensionPeriod: game.suspensionPeriod,
            stocks: catalog.map((stock) => ({ key: stock.key, name: stock.name, display: stock.display,
                imagePath: stock.imagePath,
                secondaryImagePath: stock.secondaryImagePath, variation: stock.variation })),
            insights: revealInsights(game, revealed, seats, catalog).map((insight) => ({
                _id: insight._id, playerId: insight.playerId,
                stockKey: insight.stockKey, value: insight.value, description: insight.description,
                resolved: insight.resolved, chanceKind: insight.chanceKind, used: insight.used,
                period: insight.period, bonusRole: insight.bonusRole,
                removedInsightId: insight.removedInsightId, forecast: insight.forecast,
                marketSteps: insight.marketSteps })),
        } : null;
        const players = await Promise.all(seats.map(async (seat) =>
        {
            const display = await publicIdentity(context, seat);

            return {
                id: seat._id, name: display.name, profileRoot: display.profileRoot, kind: display.kind,
                npcDifficulty: seat.controller?.kind === "npc" ? seat.npcDifficulty ?? game.npcDifficulty ?? "medium" : undefined,
                tagline: display.tagline, npcPersonality: display.npcPersonality,
                roles: stocks.flatMap((stock) => companyRoles(seats, stock.key)
                    .filter((role) => role.playerId === seat._id)
                    .map((role) => ({ stockKey: stock.key, role: role.role }))),
                cash: seat.cash, holdings: seat.holdings.filter((holding) =>
                    stocks.some((stock) => stock.key === holding.stockKey)), netWorth: netWorth(seat, game),
            };
        }));
        const feed = await context.db.query("feed").withIndex("by_game", (q) => q.eq("gameId", game._id))
            .order("desc").take(24);
        const purchase = await context.db.query("feed").withIndex("by_game", (q) => q.eq("gameId", game._id))
            .filter((q) => q.gt(q.field("quantity"), 0)).order("desc").first();

        const viewerId = await getAuthUserId(context);
        const displayHost = spectatorHost(game, seats);

        return {
            canControl: Boolean(viewerId && viewerId === (displayHost ?? game.hostId) && !game.tvTokenHash),
            reveal,
            latestPurchase: purchase ? { title: purchase.title, message: purchase.message } : null,
            game: { code: game.code, pack: game.pack, tradingDates: publicTradingDates(game),
                status: game.status, currentPeriod: game.currentPeriod,
                tvControlled: Boolean(game.tvTokenHash), spectatorControlled: Boolean(displayHost),
                periodCount: game.periodCount, turn: game.turn, rightsIssue: game.rightsIssue,
                currentPlayerId: game.currentPlayerId
                  ?? seats.find((seat) => seat.userId === game.currentUserId)?._id },
            stocks: stocks.map((stock) => ({ key: stock.key, name: stock.name, imagePath: stock.imagePath,
                secondaryImagePath: stock.secondaryImagePath, startingValue: stock.startingValue,
                value: game.prices.find((price) => price.stockKey === stock.key)?.value ?? stock.startingValue,
                held: players.reduce((sum, player) => sum + (player.holdings.find((holding) =>
                    holding.stockKey === stock.key)?.quantity ?? 0), 0) })),
            history: (game.priceHistory ?? []).map((entry) => ({ period: entry.period,
                prices: entry.prices.filter((price) => stocks.some((stock) => stock.key === price.stockKey)),
                ...(entry.steps && {
                    steps: entry.steps.filter((step) => stocks.some((stock) => stock.key === step.stockKey)),
                }) })),
            players,
            feed: feed.map((item) => ({ id: item._id, at: item._creationTime, period: item.period,
                title: item.title, message: item.message, imageRoot: item.imageRoot, colour: item.colour,
                stockKey: item.stockKey, quantity: item.quantity, cashBonus: item.cashBonus,
                debenturePayout: item.debenturePayout,
                roleBefore: item.roleBefore, roleAfter: item.roleAfter })),
        };
    },
});
