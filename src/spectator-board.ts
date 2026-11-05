import type { Board } from "./display-types";

export function spectatorBoard(board: Board)
{
    const latest = board.feed.find((item) => (item.quantity ?? 0) > 0
      || /^bought \d+ shares in /.test(item.message));

    return {
        canControl: false, reveal: null,
        latestPurchase: latest ? { title: latest.title, message: latest.message } : null,
        game: { ...board.game, turn: board.game.turn ?? 0,
            currentPlayerId: board.players.find((player) => player._id === board.game.currentPlayerId)?._id,
            tvControlled: false, spectatorControlled: true },
        players: board.players.map((player) => ({ ...player, id: player._id, roles: player.roles ?? [],
            kind: "human" as const, npcDifficulty: undefined, npcPersonality: undefined, tagline: "" })),
        stocks: board.stocks.filter((stock) => stock.display).map((stock) => ({ ...stock,
            startingValue: stock.startingValue ?? board.game.priceHistory?.[0]?.prices.find((price) =>
                price.stockKey === stock.key)?.value ?? 0,
            value: board.game.prices.find((price) => price.stockKey === stock.key)?.value ?? 0,
            held: board.players.reduce((total, player) => total + (player.holdings.find((holding) =>
                holding.stockKey === stock.key)?.quantity ?? 0), 0) })),
        history: board.game.priceHistory ?? [],
        feed: board.feed.map((item) => ({ ...item, id: item._id, at: item._creationTime,
            stockKey: item.stockKey, quantity: item.quantity, cashBonus: item.cashBonus,
            debenturePayout: item.debenturePayout, roleBefore: item.roleBefore, roleAfter: item.roleAfter })),
    };
}
