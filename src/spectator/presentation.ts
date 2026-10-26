import type { Board } from "./types";
import type { Board as DisplayBoard } from "../display-types";
import { portrait, stockLogo } from "./assets";

export function websiteBoard(board: Board): DisplayBoard
{
    const ranked = board.players.toSorted((a, b) => b.netWorth - a.netWorth);
    const reveal = board.reveal;

    return {
        game: { ...board.game, prices: reveal?.prices
          ?? board.stocks.map((stock) => ({ stockKey: stock.key, value: stock.value })),
        suspended: reveal?.suspended ?? [], priceHistory: board.history },
        stocks: reveal?.stocks ?? board.stocks.map((stock) => ({
            ...stock, display: true, imagePath: stockLogo(stock.key, stock.imagePath),
            secondaryImagePath: stockLogo(stock.key, stock.imagePath),
        })),
        insights: reveal?.insights ?? [],
        players: board.players.map(({ id, profileRoot, ...player }) => ({ ...player, _id: id,
            profileRoot: portrait(profileRoot), ranking: ranked.findIndex((item) => item.id === id) + 1 })),
        feed: board.feed.map(({ id, at, ...item }) => ({ ...item, _id: id, _creationTime: at })),
    };
}
