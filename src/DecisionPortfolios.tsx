import { NetWorthNumber } from "./RoundWealth";
import type { Board, Player } from "./display-types";

const count = (value: number) => value.toLocaleString("en-GB");
const quantityHeld = (player: Player, key: number) =>
    player.holdings.find((item) => item.stockKey === key)?.quantity ?? 0;

export function DecisionPortfolios({ board, activePlayerId, order, mutedStockKey, animateStockKey }: {
    board: Board; activePlayerId: string; order?: string[]; mutedStockKey?: number; animateStockKey?: number;
})
{
    const stocks = board.stocks.filter((stock) => stock.display);
    const players = board.players.toSorted((a, b) => order
        ? order.indexOf(a._id) - order.indexOf(b._id) : b.netWorth - a.netWorth);

    return (
        <div className="suspension-portfolios">
            <h2>Player portfolios</h2>
            <div className="suspension-table-scroll">
                <table>
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Cash</th>
                            {stocks.map((stock) => (
                                <th key={stock.key}><img src={stock.imagePath} alt={stock.name} /></th>
                            ))}
                            <th>Net worth</th>
                        </tr>
                    </thead>
                    <tbody>
                        {players.map((player) => (
                            <tr key={player._id} className={`${player._id === activePlayerId ? "is-active" : ""} ${mutedStockKey !== undefined && quantityHeld(player, mutedStockKey) === 0 ? "is-muted" : ""}`}>
                                <th>
                                    <img className="rounded" src={player.profileRoot} alt="" />
                                    {player.name}
                                </th>
                                <td>{`£${count(player.cash)}`}</td>
                                {stocks.map((stock) => (
                                    <td key={stock.key}>
                                        {
                                            animateStockKey === stock.key
                                                ? <NetWorthNumber value={quantityHeld(player, stock.key)} shares />
                                                : count(quantityHeld(player, stock.key))
                                        }
                                    </td>
                                ))}
                                <td>{`£${count(player.netWorth)}`}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
