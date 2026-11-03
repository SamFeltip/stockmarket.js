import type { Board } from "./display-types";
import { PortfolioTable } from "./PortfolioTable";

export function DecisionPortfolios({ board, activePlayerId, order, mutedStockKey, animateStockKey }: {
    board: Board; activePlayerId: string; order?: string[]; mutedStockKey?: number; animateStockKey?: number;
})
{
    const players = board.players.toSorted((a, b) => order
        ? order.indexOf(a._id) - order.indexOf(b._id) : b.netWorth - a.netWorth);

    return (
        <div className="suspension-portfolios">
            <h2>Player portfolios</h2>
            <div className="suspension-table-scroll">
                <PortfolioTable
                    stocks={board.stocks.filter((stock) => stock.display)}
                    players={players.map((player) => ({ ...player, id: player._id }))}
                    activePlayerId={activePlayerId}
                    compact
                    mutedStockKey={mutedStockKey}
                    animateStockKey={animateStockKey}
                />
            </div>
        </div>
    );
}
