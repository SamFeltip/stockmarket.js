import { cashStockKey } from "../shared/chance-cards";
import { useState } from "react";
import { money } from "./shared";
import type { Player, Stock } from "./display-types";

export function NetWorthNumber({ value, shares = false, initialValue = value, compact = false }: {
    value: number; shares?: boolean; initialValue?: number; compact?: boolean;
})
{
    const [change, setChange] = useState({ value: initialValue, delta: 0, sequence: 0 });
    if (value !== change.value)
    {
        setChange({ value, delta: value - change.value, sequence: change.sequence + 1 });
    }

    return (
        <span className="net-worth-number" aria-live="polite">
            {`${shares ? "" : "£"}${compact ? new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(value) : money(value)}`}
            {change.delta !== 0 && (
                <span
                    key={change.sequence}
                    aria-hidden="true"
                    className={`wealth-delta ${change.delta > 0 ? "wealth-gain" : "wealth-loss"}`}
                >
                    {`${change.delta > 0 ? "+" : "−"}${shares ? "" : "£"}${money(Math.abs(change.delta))}`}
                </span>
            )}
        </span>
    );
}

export function RoundWealth({ players, stock }: { players: Player[]; stock?: Stock })
{
    return (
        <section id="player-view">
            <div className="round-wealth-heading">
                <h2>Net Worth</h2>
                {stock?.display && <small className="round-wealth-stock-name">{stock.name}</small>}
            </div>
            <div className="round-wealth-players">
                {players.map((player) => (
                    <div className="round-wealth-card card card-green align-items-center text-center" key={player._id}>
                        <img className="rounded" src={player.profileRoot} alt="" />
                        <span className="round-player-name">{player.name}</span>
                        <NetWorthNumber value={player.netWorth} />
                        {stock?.key === cashStockKey && (
                            <span className="round-player-holdings round-player-cash">
                                {"Cash "}
                                <NetWorthNumber value={player.cash} />
                            </span>
                        )}
                        {stock?.display && (
                            <span className="round-player-holdings">
                                {money(player.holdings.find((holding) =>
                                    holding.stockKey === stock.key)?.quantity ?? 0)}
                                {" "}
                                <span className="round-holding-stock-name">{`${stock.name} `}</span>
                                shares
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
