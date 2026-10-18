import { useState } from "react";
import { money } from "./shared";
import type { Player } from "./types";

export function NetWorthNumber({ value }: { value: number })
{
    const [change, setChange] = useState({ value, delta: 0, sequence: 0 });
    if (value !== change.value)
    {
        setChange({ value, delta: value - change.value, sequence: change.sequence + 1 });
    }

    return (
        <span className="net-worth-number" aria-live="polite">
            {`£${money(value)}`}
            {change.delta !== 0 && (
                <span
                    key={change.sequence}
                    aria-hidden="true"
                    className={`wealth-delta ${change.delta > 0 ? "wealth-gain" : "wealth-loss"}`}
                >
                    {`${change.delta > 0 ? "+" : "−"}£${money(Math.abs(change.delta))}`}
                </span>
            )}
        </span>
    );
}

export function RoundWealth({ players }: { players: Player[] })
{
    return (
        <section id="player-view" className="card card-green p-3 rounded">
            <h2>Net Worth</h2>
            <div className="round-wealth-players">
                {players.map((player) => (
                    <div className="d-flex flex-column align-items-center" key={player._id}>
                        <img className="rounded" src={player.profileRoot} alt="" />
                        <span className="round-player-name">{player.name}</span>
                        <NetWorthNumber value={player.netWorth} />
                    </div>
                ))}
            </div>
        </section>
    );
}
