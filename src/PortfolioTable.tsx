import { CompanyHolding } from "./CompanyHolding";
import { NetWorthNumber } from "./RoundWealth";
import type { CompanyRole } from "../shared/company-roles";
import "./portfolio-table.css";

const count = (value: number) => new Intl.NumberFormat("en-GB", {
    notation: "compact", maximumFractionDigits: 1,
}).format(value);
const money = (value: number, compact: boolean) => new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
}).format(value);

interface TablePlayer {
    id: string; name: string; profileRoot: string; cash: number; netWorth: number;
    holdings: { stockKey: number; quantity: number }[];
    roles?: { stockKey: number; role: CompanyRole }[];
}

/** The spectator portfolio table, with optional decision order and compact cash values. */
export function PortfolioTable({ stocks, players, activePlayerId, compact = false, mutedStockKey, animateStockKey }: {
    stocks: { key: number; name: string; imagePath: string }[];
    players: TablePlayer[]; activePlayerId?: string; compact?: boolean;
    mutedStockKey?: number; animateStockKey?: number;
})
{
    return (
        <table className="portfolio-table">
            <colgroup>
                <col style={{ width: "24%" }} />
                <col style={{ width: "12%" }} />
                {stocks.map((stock) => <col key={stock.key} style={{ width: `${52 / stocks.length}%` }} />)}
                <col style={{ width: "12%" }} />
            </colgroup>
            <thead>
                <tr>
                    <th scope="col">Player</th>
                    <th scope="col">Cash</th>
                    {stocks.map((stock) => <th scope="col" key={stock.key}><img className="table-logo" src={stock.imagePath} alt={stock.name} /></th>)}
                    <th scope="col">Net worth</th>
                </tr>
            </thead>
            <tbody>
                {players.map((player, index) => (
                    <tr key={player.id} className={`${player.id === activePlayerId ? "current is-active" : ""} ${mutedStockKey !== undefined && !player.holdings.some((holding) => holding.stockKey === mutedStockKey && holding.quantity > 0) ? "is-muted" : ""}`}>
                        <th scope="row">
                            <div className="player-cell">
                                <span className="rank">{index + 1}</span>
                                <img className="player-avatar rounded" src={player.profileRoot} alt="" />
                                <span>{player.name}</span>
                                {player.id === activePlayerId && <span className="turn-dot" />}
                            </div>
                        </th>
                        <td>{money(player.cash, compact)}</td>
                        {stocks.map((stock) =>
                        {
                            const quantity = player.holdings.find((holding) =>
                                holding.stockKey === stock.key)?.quantity ?? 0;

                            return (
                                <td key={stock.key}>
                                    {animateStockKey === stock.key ? (
                                        <NetWorthNumber value={quantity} shares compact />
                                    ) : (
                                        <CompanyHolding
                                            quantity={count(quantity)}
                                            role={player.roles?.find((role) => role.stockKey === stock.key)?.role}
                                            company={stock.name}
                                        />
                                    )}
                                </td>
                            );
                        })}
                        <td className="wealth">{money(player.netWorth, compact)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
