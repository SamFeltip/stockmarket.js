import { stockCatalog } from "./catalog";
import { query } from "./_generated/server";
import { v } from "convex/values";
import { member, members, netWorth, roundInsights } from "./library";

export const get = query({
    args: { code: v.string() },
    handler: async (context, { code }) =>
    {
        const { game, player, user } = await member(context, code);
        const seats = await members(context, game._id);
        const stocks = (await context.db.query("stocks").collect())
            .map((stock) => ({ ...stock,
                variation: stockCatalog.find((item) => item.key === stock.key)?.variation ?? stock.variation }))
            .toSorted((a, b) => a.variation - b.variation);
        const allInsights = await roundInsights(context, game);
        const reveal = game.status === "closed" || game.status === "special_insights" || game.status === "finished";
        const players = await Promise.all(seats.map(async (seat) =>
        {
            const account = await context.db.get(seat.userId);

            return { ...seat, name: account?.name ?? "Unknown", profileRoot: account?.profileRoot ?? "",
                netWorth: netWorth(seat, game) };
        }));
        const ranking = [...players].toSorted((a, b) => b.netWorth - a.netWorth);
        const feed = await context.db.query("feed").withIndex("by_game", (q) => q.eq("gameId", game._id))
            .order("desc").take(100);

        return {
            game, player, user: { _id: user._id, name: user.name, profileRoot: user.profileRoot }, stocks, feed,
            players: players.map((seat) => ({
                ...seat, ranking: ranking.findIndex((item) => item._id === seat._id) + 1,
            })),
            // Opponents' private insights never cross the wire while trading is open.
            insights: allInsights.filter((insight) => reveal || insight.playerId === player._id),
        };
    },
});
