import * as engine from "../../stockmarket-shared/src/engine/library";
import { readEngine, runEngine, type Arguments } from "./engine";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { MutationCtx as MutationContext, QueryCtx as QueryContext } from "./_generated/server";
import type { Doc as Document_, Id } from "./_generated/dataModel";

export function fail(message: string): never
{
    throw new ConvexError(message);
}

export async function currentUser(context: QueryContext)
{
    const id = await getAuthUserId(context);
    const user = id ? await context.db.get(id) : null;

    return user ?? fail("Please log in");
}

export function normalizeCode(code: string)
{
    const normalized = code.trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,32}$/.test(normalized))
    {
        fail("Lobby code must contain 1–32 letters, numbers, hyphens or underscores");
    }

    return normalized;
}

export async function gameByCode(context: QueryContext, code: string)
{
    return await context.db.query("games").withIndex("by_code", (q) => q.eq("code", normalizeCode(code)))
        .unique() ?? fail("No game found!");
}

export function members(context: QueryContext, ...arguments_: Arguments<typeof engine.members>)
{
    return engine.members(readEngine(context), ...arguments_);
}

export async function member(context: QueryContext, code: string)
{
    const user = await currentUser(context);
    const game = await gameByCode(context, code);
    const player = await context.db.query("players").withIndex("by_game_user", (q) =>
        q.eq("gameId", game._id).eq("userId", user._id)).unique();
    if (!player?.active)
    {
        fail("Join this game first");
    }

    const prepared = player.directorSince === undefined
        ? (await members(context, game._id)).find((seat) => seat._id === player._id)! : player;

    return { user, game, player: prepared };
}

export function seedStocks(context: MutationContext)
{
    return runEngine(context, engine.seedStocks);
}

export function roundInsights(context: QueryContext, ...arguments_: Arguments<typeof engine.roundInsights>)
{
    return engine.roundInsights(readEngine(context), ...arguments_);
}

export function feedItem(context: MutationContext, ...arguments_: Arguments<typeof engine.feedItem>)
{
    return runEngine(context, (runtime) => engine.feedItem(runtime, ...arguments_));
}

export const netWorth = engine.netWorth;

export function revealCursor(context: QueryContext, gameId: Id<"games">)
{
    return context.db.query("revealCursors").withIndex("by_game", (q) => q.eq("gameId", gameId)).unique();
}

export async function revealProgress(context: QueryContext, game: Document_<"games">)
{
    const cursor = await revealCursor(context, game._id);

    return cursor?.period === game.currentPeriod ? { step: cursor.step, summary: cursor.summary } : game.revealProgress;
}

async function legacyTradeHistory(context: QueryContext, gameId: Id<"games">, seatCount: number,
    before: number | undefined)
{
    const feed = await context.db.query("feed").withIndex("by_game_period", (q) =>
    {
        const range = q.eq("gameId", gameId);

        return before === undefined ? range : range.lt("period", before);
    })
        .filter((q) => q.neq(q.field("quantity"), undefined)).collect();
    const trades = feed.flatMap(({ stockKey, period, title, imageRoot, quantity, debenturePayout, redemptionName }) =>
        stockKey !== undefined && quantity
            ? [{ stockKey, period, title, imageRoot, quantity, debenturePayout, redemptionName }] : []);
    if (trades.length === 0)
    {
        return [];
    }

    const actions = await context.db.query("gameActions")
        .withIndex("by_game_period_turn", (q) =>
        {
            const range = q.eq("gameId", gameId);

            return before === undefined ? range : range.lt("period", before);
        }).collect();
    const periods = new Set(trades.map((trade) => trade.period));

    return [...periods].flatMap((period) =>
    {
        const events = trades.filter((trade) => trade.period === period);
        const recorded = actions.filter((entry) => entry.period === period
          && (entry.action.kind === "buy" || entry.action.kind === "sell" || entry.action.kind === "debenture"));
        // Keep the original public names and portraits. Older records with incomplete logs
        // retain their trades without guessing which round they belonged to.
        const matched = seatCount > 0 && recorded.length === events.length && events.every((trade, index) =>
        {
            const { action, turn } = recorded[index];
            if (!("stockKey" in action) || action.stockKey !== trade.stockKey || turn < 0 || turn >= seatCount * 3)
            {
                return false;
            }

            return action.kind === "debenture" ? trade.debenturePayout !== undefined
                : trade.debenturePayout === undefined && trade.quantity === (action.kind === "buy" ? 1 : -1) * action.quantity;
        });

        return events.map(({ stockKey, title, imageRoot, quantity, debenturePayout, redemptionName }, index) => ({
            stockKey, period, title, imageRoot, quantity,
            ...(debenturePayout !== undefined && { debenturePayout }),
            ...(redemptionName && { redemptionName }),
            bargainRound: matched ? Math.floor(recorded[index].turn / seatCount) + 1 : undefined,
        }));
    });
}

export interface TradeHistoryRange { from: number; before: number }

// New trades carry the exact chart position in the same row as the public activity event.
export async function tradeHistory(context: QueryContext, gameId: Id<"games">, seatCount: number,
    start?: number, range?: TradeHistoryRange)
{
    const legacy = start === 0 ? [] : await legacyTradeHistory(context, gameId, seatCount, start);
    if (start === undefined)
    {
        return legacy;
    }

    const recorded = await context.db.query("feed")
        .withIndex("by_game_chart_period", (q) => range
            ? q.eq("gameId", gameId).gte("chartPeriod", Math.max(start, range.from)).lt("chartPeriod", range.before)
            : q.eq("gameId", gameId).gte("chartPeriod", start))
        .collect();

    return legacy.concat(recorded.flatMap((item) =>
    {
        const { period, title, imageRoot, stockKey, quantity, bargainRound, debenturePayout, redemptionName } = item;

        return stockKey !== undefined && quantity ? [{ period, title, imageRoot, stockKey, quantity,
            bargainRound, ...(debenturePayout !== undefined && { debenturePayout }),
            ...(redemptionName && { redemptionName }) }] : [];
    }));
}
