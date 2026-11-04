import * as engine from "../../stockmarket-shared/src/engine/library";
import { readEngine, runEngine, type Arguments } from "./engine";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { MutationCtx as MutationContext, QueryCtx as QueryContext } from "./_generated/server";

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
