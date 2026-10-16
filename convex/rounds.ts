import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { deal, fail, feedItem, member, members, roundInsights } from "./library";

export const showSpecial = mutation({
    args: { code: v.string() },
    handler: async (context, { code }) =>
    {
        const { game } = await member(context, code);
        if (game.status !== "closed")
        {
            fail("The market must be closed");
        }

        // Compatibility endpoint: reveal progress belongs to each browser, not the shared game.
    },
});

export const hold = mutation({
    args: { code: v.string(), insightId: v.id("playerInsights"), stockKey: v.optional(v.number()) },
    handler: async (context, { code, insightId, stockKey }) =>
    {
        const { game, player } = await member(context, code);
        if (game.status !== "closed" && game.status !== "special_insights")
        {
            fail("Wait for special insights");
        }

        const insight = await context.db.get(insightId);
        if (!insight || insight.gameId !== game._id || insight.period !== game.currentPeriod
          || insight.playerId !== player._id || insight.resolved)
        {
            fail("This insight cannot be used");
        }

        const special = await context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", insight.stockKey)).unique();
        if (special?.name !== "Hold Stock Price")
        {
            fail("This is not a hold-stock insight");
        }

        if (stockKey !== undefined)
        {
            const stock = await context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", stockKey)).unique();
            if (!stock?.display)
            {
                fail("Choose a tradable stock");
            }

            await context.db.patch(game._id, { suspended: [...new Set([...game.suspended, stockKey])] });
        }

        await context.db.patch(insightId, { resolved: true });
    },
});

export const next = mutation({
    args: { code: v.string(), expectedPeriod: v.number() },
    handler: async (context, { code, expectedPeriod }) =>
    {
        const { game, user } = await member(context, code);
        if (game.hostId !== user._id)
        {
            fail("Only the lobby host can advance the round");
        }

        if ((game.status !== "closed" && game.status !== "special_insights") || game.currentPeriod !== expectedPeriod)
        {
            fail("The round has already changed");
        }

        const insights = await roundInsights(context, game);
        const stocks = await context.db.query("stocks").collect();
        const holds = new Set(stocks.filter((stock) => stock.name === "Hold Stock Price").map((stock) => stock.key));
        if (insights.some((insight) => holds.has(insight.stockKey) && !insight.resolved))
        {
            fail("Wait for players to resolve their hold-stock insights");
        }

        const prices = game.prices.map((price) =>
        {
            const stock = stocks.find((item) => item.key === price.stockKey);
            const change = stock?.display && !game.suspended.includes(price.stockKey)
                ? insights.filter((insight) => insight.stockKey === price.stockKey)
                    .reduce((sum, insight) => sum + insight.value, 0) : 0;

            return { ...price, value: Math.max(0, price.value + change) };
        });
        const currencyKeys = new Set(stocks.filter((stock) => stock.name === "currency").map((stock) => stock.key));
        const players = await members(context, game._id);
        for (const seat of players)
        {
            const change = insights.filter((insight) =>
                insight.playerId === seat._id && currencyKeys.has(insight.stockKey))
                .reduce((sum, insight) => sum + insight.value, 0);

            await context.db.patch(seat._id, { cash: Math.max(0, Math.trunc(seat.cash * (1 + change))) });
        }

        const finished = game.currentPeriod >= game.periodCount;
        const currentPeriod = finished ? game.currentPeriod : game.currentPeriod + 1;

        await context.db.patch(game._id, { prices, status: finished ? "finished" : "playing", currentPeriod,
            turn: 0, suspended: [], currentUserId: players[currentPeriod % players.length].userId });

        if (!finished)
        {
            await deal(context, { ...game, currentPeriod }, players);
            await feedItem(context, { ...game, currentPeriod }, `Period ${currentPeriod + 1}`,
                "Players get another turn", "/static/imgs/icons/Stock.svg", "grey");
        }
    },
});
