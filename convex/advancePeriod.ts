import type { MutationCtx as MutationContext } from "./_generated/server";
import type { Doc as Document_ } from "./_generated/dataModel";
import { roundCash, roundPrices } from "../shared/settlement";
import { deal, fail, feedItem, members, roundInsights } from "./library";
import { enqueueNextNpcIfNeeded } from "./npc/scheduling";
import { publicSeats } from "./game/legalActions";

export async function advancePeriod(context: MutationContext, game: Document_<"games">, expectedPeriod: number)
{
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

    const prices = roundPrices(game.prices, insights, stocks, game.suspended);
    const players = await members(context, game._id);
    for (const seat of players)
    {
        await context.db.patch(seat._id, { cash: roundCash(seat, insights, stocks) });
    }

    await context.db.insert("periodSummaries", { gameId: game._id, period: game.currentPeriod,
        opening: game.prices, settled: prices });
    const rankings = publicSeats(await members(context, game._id), prices);
    for (const seat of players)
    {
        await context.db.patch(seat._id, { periodStartRanking: rankings.find((item) =>
            item.id === seat._id)!.ranking });
    }

    const finished = game.currentPeriod >= game.periodCount;
    const currentPeriod = finished ? game.currentPeriod : game.currentPeriod + 1;
    const priceHistory = [
        ...game.priceHistory ?? [{ period: game.currentPeriod, prices: game.prices }],
        { period: game.currentPeriod + 1, prices },
    ];

    await context.db.patch(game._id, { prices, priceHistory, status: finished ? "finished" : "playing", currentPeriod,
        turn: 0, suspended: [], currentUserId: players[currentPeriod % players.length].userId,
        currentPlayerId: players[currentPeriod % players.length]._id });

    if (!finished)
    {
        await deal(context, { ...game, currentPeriod }, players);
        await feedItem(context, { ...game, currentPeriod }, `Period ${currentPeriod + 1}`,
            "Players get another turn", "/static/imgs/icons/Stock.svg", "grey");
        await enqueueNextNpcIfNeeded(context, game._id);
    }
}
