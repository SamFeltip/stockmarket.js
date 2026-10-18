import { portfolioWorth, roundCash, roundPrices } from "../shared/settlement";
import { revealStocks } from "./reveals";
import type { Board, Insight } from "./types";

export function previewRound(board: Board, insights: Insight[], revealedStockKeys: number[]): Board
{
    const prices = roundPrices(board.game.prices, insights, board.stocks, board.game.suspended);
    const players = board.players.map((player) =>
    {
        const cash = roundCash(player, insights, board.stocks);

        return { ...player, cash, netWorth: portfolioWorth({ ...player, cash }, prices) };
    });
    const ranked = players.toSorted((a, b) => b.netWorth - a.netWorth);
    const history = board.game.priceHistory ?? [{ period: board.game.currentPeriod, prices: board.game.prices }];

    return { ...board,
        game: { ...board.game, prices, priceHistory: [...history,
            { period: board.game.currentPeriod + 1, prices: prices.filter((price) =>
                revealedStockKeys.includes(price.stockKey)) }] },
        players: players.map((player) => ({ ...player,
            ranking: ranked.findIndex((item) => item._id === player._id) + 1 })),
    };
}

export function roundProgress(board: Board, step: number, index: number)
{
    const groups = revealStocks(board.stocks, board.insights);
    const current = groups[step];
    const visible = board.insights.filter((insight) => insight.stockKey === current?.key);
    const previousKeys = new Set(groups.slice(0, step).map((stock) => stock.key));
    const completedKeys = groups.slice(0, step + (index >= visible.length ? 1 : 0)).map((stock) => stock.key);
    const completed = new Set(completedKeys);
    const previousInsights = board.insights.filter((insight) => previousKeys.has(insight.stockKey));

    return {
        preview: previewRound(board, previousInsights.concat(visible.slice(0, index + 1)),
            groups.slice(0, step + 1).map((stock) => stock.key)),
        wealth: previewRound(board, board.insights.filter((insight) => completed.has(insight.stockKey)), completedKeys),
    };
}
