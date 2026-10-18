import { portfolioWorth } from "../shared/settlement";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { MutationCtx as MutationContext, QueryCtx as QueryContext } from "./_generated/server";
import type { Doc as Document_, Id } from "./_generated/dataModel";
import { stockCatalog, insightCatalog } from "./catalog";

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

export async function members(context: QueryContext, gameId: Id<"games">)
{
    const seats = await context.db.query("players").withIndex("by_game", (q) => q.eq("gameId", gameId)).collect();

    const order = new Map(seats.map((seat, index) => [seat._id, seat.seatOrder ?? index]));

    return seats.toSorted((a, b) => order.get(a._id)! - order.get(b._id)!);
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

    return { user, game, player };
}

export async function seedCatalog(context: MutationContext)
{
    if (await context.db.query("stocks").first())
    {
        return;
    }

    for (const stock of stockCatalog)
    {
        await context.db.insert("stocks", stock);
    }

    for (const insight of insightCatalog)
    {
        await context.db.insert("insights", insight);
    }
}

export async function roundInsights(context: QueryContext, game: Document_<"games">)
{
    return await context.db.query("playerInsights").withIndex("by_game_period", (q) =>
        q.eq("gameId", game._id).eq("period", game.currentPeriod)).collect();
}

export async function deal(context: MutationContext, game: Document_<"games">, players: Document_<"players">[])
{
    const snapshot = await context.db.query("gameCatalogs").withIndex("by_game", (q) => q.eq("gameId", game._id)).unique();
    const deck = snapshot ? [...snapshot.cards] : (await context.db.query("insights").collect())
        .map((card) => ({ ...card, id: String(card._id) }));
    if (deck.length < players.length * 10)
    {
        fail("Not enough insights for all players");
    }

    // Convex supplies seeded randomness that is stable across transaction retries.
    for (let index = deck.length - 1; index > 0; index--)
    {
        const index_ = Math.floor(Math.random() * (index + 1));

        [deck[index], deck[index_]] = [deck[index_], deck[index]];
    }

    for (const [index, player] of players.entries())
    {
        for (const insight of deck.slice(index * 10, index * 10 + 10))
        {
            await context.db.insert("playerInsights", {
                gameId: game._id, playerId: player._id, period: game.currentPeriod,
                stockKey: insight.stockKey, description: insight.description, value: insight.value, resolved: false,
                catalogCardId: insight.id,
            });
        }
    }
}

export async function feedItem(context: MutationContext, game: Document_<"games">, title: string,
    message: string, imageRoot: string, colour = "", trade: { stockKey?: number; quantity?: number } = {})
{
    await context.db.insert("feed", { gameId: game._id, period: game.currentPeriod, title, message, imageRoot, colour, ...trade });
}

export function netWorth(player: Document_<"players">, game: Document_<"games">)
{
    return portfolioWorth(player, game.prices);
}
