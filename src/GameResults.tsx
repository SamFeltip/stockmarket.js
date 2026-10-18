import { useState } from "react";
import { Link } from "react-router-dom";
import { money } from "./shared";
import { FinalHoldings } from "./FinalHoldings";
import { StockHistoryStrip } from "./StockHistoryStrip";
import type { Board } from "./types";

export function GameResults({ board }: { board: Board })
{
    const players = board.players.toSorted((a, b) => b.netWorth - a.netWorth);
    const [selectedId, setSelectedId] = useState<string | null>(players[0]?._id ?? null);
    const selected = players.find((player) => player._id === selectedId) ?? players[0];

    return (
        <div className="game-results card card-green text-center">
            <header className="results-heading">
                <p>Game finished</p>
                <h1>{`${players[0]?.name ?? ""} wins!`}</h1>
            </header>
            <div className="results-main">
                <ol className="results-leaderboard" aria-label="Final rankings">
                    {players.map((player) => (
                        <li key={player._id} className={selectedId === player._id ? "is-selected" : ""}>
                            <button
                                type="button"
                                className="result-player-button"
                                aria-expanded={selectedId === player._id}
                                aria-controls={`desktop-portfolio portfolio-${player._id}`}
                                onClick={() => setSelectedId((current) => current === player._id
                                  && !globalThis.matchMedia("(min-width: 992px)").matches ? null : player._id)}
                            >
                                <span className="result-rank">{player.ranking}</span>
                                <img className="rounded" src={player.profileRoot} alt="" />
                                <span>
                                    <strong>{player.name}</strong>
                                    <span>{`Net worth £${money(player.netWorth)}`}</span>
                                </span>
                            </button>
                            <div
                                id={`portfolio-${player._id}`}
                                className="mobile-player-portfolio text-black bg-white"
                                hidden={selectedId !== player._id}
                            >
                                <p>{`Cash £${money(player.cash)}`}</p>
                                <FinalHoldings board={board} player={player} />
                            </div>
                        </li>
                    ))}
                </ol>
                {selected && (
                    <section
                        id="desktop-portfolio"
                        className="desktop-player-portfolio bg-white text-black rounded"
                        aria-label={`${selected.name}'s portfolio`}
                    >
                        <h2 className="text-black">{`${selected.name}'s portfolio`}</h2>
                        <p>{`Cash £${money(selected.cash)} · Stocks worth £${money(selected.netWorth - selected.cash)}`}</p>
                        <FinalHoldings board={board} player={selected} />
                    </section>
                )}
            </div>
            <StockHistoryStrip board={board} />
            <footer className="results-footer"><Link className="btn btn-primary" to="/">Go Back</Link></footer>
        </div>
    );
}
