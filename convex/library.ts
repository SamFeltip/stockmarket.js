import * as engine from "../../stockmarket-shared/src/engine/library";
import { readEngine, runEngine, type Arguments } from "./engine";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { MutationCtx as MutationContext, QueryCtx as QueryContext } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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

export function seedCatalog(context: MutationContext, ...arguments_: Arguments<typeof engine.seedCatalog>)
{
    return runEngine(context, (runtime) => engine.seedCatalog(runtime, ...arguments_));
}

export function roundInsights(context: QueryContext, ...arguments_: Arguments<typeof engine.roundInsights>)
{
    return engine.roundInsights(readEngine(context), ...arguments_);
}

export function deal(context: MutationContext, ...arguments_: Arguments<typeof engine.deal>)
{
    return runEngine(context, (runtime) => engine.deal(runtime, ...arguments_));
}

export function feedItem(context: MutationContext, ...arguments_: Arguments<typeof engine.feedItem>)
{
    return runEngine(context, (runtime) => engine.feedItem(runtime, ...arguments_));
}

export const netWorth = engine.netWorth;

/** Public trades outlive the rolling activity feed used by the interface. */
export async function tradeHistory(context: QueryContext, gameId: Id<"games">, seatCount: number)
{
    const feed = await context.db.query("feed").withIndex("by_game", (q) => q.eq("gameId", gameId))
        .filter((q) => q.neq(q.field("quantity"), undefined)).collect();
    const trades = feed.flatMap(({ stockKey, period, title, imageRoot, quantity, debenturePayout }) =>
        stockKey !== undefined && quantity ? [{ stockKey, period, title, imageRoot, quantity, debenturePayout }] : []);
    if (trades.length === 0)
    {
        return [];
    }

    const actions = await context.db.query("gameActions")
        .withIndex("by_game_period_turn", (q) => q.eq("gameId", gameId)).collect();
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

        return events.map(({ stockKey, title, imageRoot, quantity }, index) => ({
            stockKey, period, title, imageRoot, quantity,
            bargainRound: matched ? Math.floor(recorded[index].turn / seatCount) + 1 : undefined,
        }));
    });
}
