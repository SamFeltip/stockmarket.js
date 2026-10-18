import { portfolioWorth, roundCash, roundPrices } from "../shared/settlement";
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
