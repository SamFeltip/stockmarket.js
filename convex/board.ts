import { stockCatalog } from "./catalog";
import { query } from "./_generated/server";
import { v } from "convex/values";
import { member, members, netWorth, roundInsights } from "./library";

import { publicIdentity } from "./npc/identity";

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
            const display = await publicIdentity(context, seat);

            return { _id: seat._id, _creationTime: seat._creationTime, gameId: seat.gameId,
                userId: seat.userId, controller: seat.controller ?? { kind: "human" as const, userId: seat.userId! },
                cash: seat.cash, holdings: seat.holdings, active: seat.active, ...display,
                npcDifficulty: display.kind === "npc" ? seat.npcDifficulty ?? game.npcDifficulty ?? "medium" : undefined,
                netWorth: netWorth(seat, game) };
        }));
        const ranking = [...players].toSorted((a, b) => b.netWorth - a.netWorth);
        const feed = await context.db.query("feed").withIndex("by_game", (q) => q.eq("gameId", game._id))
            .order("desc").take(100);

        return {
            game: { _id: game._id, _creationTime: game._creationTime, code: game.code, hostId: game.hostId,
                currentPlayerId: game.currentPlayerId ?? seats.find((seat) => seat.userId === game.currentUserId)?._id,
                currentUserId: game.currentUserId, currentPeriod: game.currentPeriod, periodCount: game.periodCount,
                prices: game.prices, priceHistory: game.priceHistory, status: game.status, turn: game.turn,
                suspended: game.suspended, npcDifficulty: game.npcDifficulty ?? "medium" },
            player, user: { _id: user._id, name: user.name, profileRoot: user.profileRoot }, stocks, feed,
            players: players.map((seat) => ({
                ...seat, ranking: ranking.findIndex((item) => item._id === seat._id) + 1,
            })),
            // Opponents' private insights never cross the wire while trading is open.
            insights: allInsights.filter((insight) => reveal || insight.playerId === player._id),
        };
    },
});
