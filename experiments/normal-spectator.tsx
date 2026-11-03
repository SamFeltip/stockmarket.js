import { RightsIssue } from "../src/RightsIssue";
import { SpectatorScreen } from "../src/spectator/SpectatorPage";
import type { Board } from "../src/types";
import type { Board as PublicBoard } from "../src/spectator/types";

/** Render the actual normal-play web spectator screen with the offline game fixture. */
export function NormalSpectatorDemo({ board }: { board: Board })
{
    const publicBoard: PublicBoard = {
        canControl: false,
        reveal: null,
        latestPurchase: { title: board.feed[0].title, message: board.feed[0].message },
        game: { ...board.game, rightsIssue: undefined, tvControlled: false, spectatorControlled: true },
        players: board.players.map((player) => ({ ...player, id: player._id, roles: player.roles ?? [],
            kind: "human", npcDifficulty: undefined, tagline: "" })),
        stocks: board.stocks.filter((stock) => stock.display).map((stock) => ({ ...stock,
            value: board.game.prices.find((price) => price.stockKey === stock.key)?.value ?? stock.startingValue,
            held: board.players.reduce((total, player) => total + (player.holdings.find((holding) =>
                holding.stockKey === stock.key)?.quantity ?? 0), 0) })),
        history: board.game.priceHistory ?? [],
        feed: board.feed.map((item) => ({ ...item, id: item._id, at: item._creationTime,
            stockKey: item.stockKey, quantity: item.quantity, cashBonus: item.cashBonus,
            debenturePayout: item.debenturePayout, roleBefore: item.roleBefore, roleAfter: item.roleAfter })),
    };

    return <div className="web-spectator"><SpectatorScreen board={publicBoard} /></div>;
}

export function RightsSpectatorDemo({ board, onDecision }: {
    board: Board; onDecision: (quantity: number) => Promise<unknown>;
})
{
    return board.game.rightsIssue
        ? <RightsIssue board={board} spectator onDecision={onDecision} /> : <NormalSpectatorDemo board={board} />;
}
