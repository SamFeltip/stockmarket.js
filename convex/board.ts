import { debentureInHand } from "../shared/debenture";
import { debentureOffers } from "./game/debenture";
import { withRoleBonuses, companyRoles } from "../shared/company-roles";
import { stockCatalog } from "./catalog";
import { query } from "./_generated/server";
import { v } from "convex/values";
import { member, members, netWorth, roundInsights, tradeHistory } from "./library";

import { phoneHost, spectatorHost } from "./game/hosting";
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
        const retained = (await context.db.query("playerInsights")
            .withIndex("by_player_period", (q) => q.eq("playerId", player._id)).collect())
            .filter((card) => card.chanceKind === "debenture" && card.period < game.currentPeriod
              && debentureInHand(card, game.currentPeriod));
        const debentures = allInsights.some((card) => card.playerId === player._id && card.chanceKind === "debenture"
          && !card.used) || retained.length > 0;
        const claims = debentures ? await debentureOffers(context, game, player) : [];
        const reveal = game.status === "closed" || game.status === "special_insights" || game.status === "finished";
        const players = await Promise.all(seats.map(async (seat) =>
        {
            const display = await publicIdentity(context, seat);

            return { _id: seat._id, _creationTime: seat._creationTime, gameId: seat.gameId,
                userId: seat.userId, controller: seat.controller ?? { kind: "human" as const, userId: seat.userId! },
                roles: stocks.flatMap((stock) => companyRoles(seats, stock.key)
                    .filter((role) => role.playerId === seat._id)
                    .map((role) => ({ stockKey: stock.key, role: role.role }))),
                cash: seat.cash, holdings: seat.holdings, active: seat.active, ...display,
                npcDifficulty: display.kind === "npc" ? seat.npcDifficulty ?? game.npcDifficulty ?? "medium" : undefined,
                netWorth: netWorth(seat, game) };
        }));
        const ranking = [...players].toSorted((a, b) => b.netWorth - a.netWorth);
        const [feed, trades] = await Promise.all([
            context.db.query("feed").withIndex("by_game", (q) => q.eq("gameId", game._id)).order("desc").take(100),
            tradeHistory(context, game._id),
        ]);

        return {
            game: { _id: game._id, _creationTime: game._creationTime, code: game.code, hostId: phoneHost(game, seats),
                currentPlayerId: game.currentPlayerId ?? seats.find((seat) => seat.userId === game.currentUserId)?._id,
                currentUserId: game.currentUserId, currentPeriod: game.currentPeriod, periodCount: game.periodCount,
                tvControlled: Boolean(game.tvTokenHash), spectatorControlled: Boolean(spectatorHost(game, seats)),
                prices: game.prices, priceHistory: game.priceHistory, status: game.status, turn: game.turn,
                suspended: game.suspended, suspensionPeriod: game.suspensionPeriod, rightsIssue: game.rightsIssue, npcDifficulty: game.npcDifficulty ?? "medium" },
            debentureOffers: claims,
            player, user: { _id: user._id, name: user.name, profileRoot: user.profileRoot }, stocks, feed,
            trades,
            players: players.map((seat) => ({
                ...seat, ranking: ranking.findIndex((item) => item._id === seat._id) + 1,
            })),
            // Opponents' private insights never cross the wire while trading is open.
            insights: withRoleBonuses(allInsights.filter((insight) => reveal || insight.playerId === player._id),
                seats, reveal ? stocks : []).concat(retained),
        };
    },
});
