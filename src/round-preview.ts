import { nextTradingSuspensions, tradingPrices } from "../shared/suspensions";
import { portfolioWorth, roundCash, roundPrices, roundPriceSteps } from "../shared/settlement";
import { revealGroups } from "./reveals";
import type { Board, Insight } from "./display-types";

export function previewRound<T extends Board>(board: T, insights: Insight[], revealedStockKeys: number[],
    chartInsights = insights): T
{
    const prices = roundPrices(board.game.prices, insights, board.stocks, board.game.suspended);
    const tradingSuspensions = nextTradingSuspensions(board.game, board.players);
    const players = board.players.map((player) =>
    {
        const cash = roundCash(player, insights, board.stocks);

        const quotes = tradingPrices({ prices, tradingSuspensions }, player._id);

        return { ...player, cash, netWorth: portfolioWorth({ ...player, cash }, quotes) };
    });
    const ranked = players.toSorted((a, b) => b.netWorth - a.netWorth);
    const history = board.game.priceHistory ?? [{ period: board.game.currentPeriod, prices: board.game.prices }];

    return { ...board,
        game: { ...board.game, prices, tradingSuspensions, priceHistory: [...history,
            { period: board.game.currentPeriod + 1, prices: prices.filter((price) =>
                revealedStockKeys.includes(price.stockKey)),
            steps: roundPriceSteps(board.game.prices, chartInsights, board.stocks, board.game.suspended, board.insights)
                .filter((item) => revealedStockKeys.includes(item.stockKey)) }] },
        players: players.map((player) => ({ ...player,
            ranking: ranked.findIndex((item) => item._id === player._id) + 1 })),
    };
}

function chartCards(visible: Insight[], revealed: Insight[])
{
    const closingCard = visible.find((card) => card.marketSteps);
    if (!closingCard?.marketSteps || revealed.includes(closingCard) || revealed.length === 0)
    {
        return revealed;
    }

    // Forecasts can overlap. Uncover the actual closes in order as the cards play.
    const count = Math.floor(closingCard.marketSteps.length * revealed.length / visible.length);

    return [...revealed, { ...closingCard, marketSteps: closingCard.marketSteps.slice(0, count) }];
}

export function roundProgress<T extends Board>(board: T, step: number, index: number)
{
    const groups = revealGroups(board.stocks, board.insights);
    const current = groups[step];
    const visible = board.insights.filter((insight) => insight.stockKey === current?.key);
    const previousKeys = new Set(groups.slice(0, step).map((stock) => stock.key));
    const completedKeys = groups.slice(0, step + (index >= visible.length ? 1 : 0)).map((stock) => stock.key);
    const completed = new Set(completedKeys);
    const previousInsights = board.insights.filter((insight) => previousKeys.has(insight.stockKey));
    const revealed = visible.slice(0, index + 1);
    const chartInsights = previousInsights.concat(chartCards(visible, revealed));

    return {
        preview: previewRound(board, previousInsights.concat(revealed),
            groups.slice(0, step + 1).map((stock) => stock.key), chartInsights),
        wealth: previewRound(board, board.insights.filter((insight) => completed.has(insight.stockKey)), completedKeys),
    };
}
