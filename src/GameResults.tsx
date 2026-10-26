import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { portfolioCollapse } from "./bootstrap";
import { MobilePortfolio } from "./MobilePortfolio";
import { money } from "./shared";
import { FinalHoldings } from "./FinalHoldings";
import { StockHistoryStrip } from "./StockHistoryStrip";
import type { Board } from "./display-types";

export function GameResults({ board, onBack }: { board: Board; onBack?: () => void })
{
    const players = board.players.toSorted((a, b) => b.netWorth - a.netWorth);
    const [selectedId, setSelectedId] = useState<string | null>(players[0]?._id ?? null);
    const selected = players.find((player) => player._id === selectedId) ?? players[0];
    const winnerId = players[0]?._id;
    const selection = useRef(selectedId);

    useEffect(() =>
    {
        selection.current = selectedId;
    }, [selectedId]);

    useEffect(() =>
    {
        const desktop = matchMedia("(min-width: 992px)");

        const resize = () =>
        {
            if (desktop.matches && selection.current === null)
            {
                setSelectedId(winnerId ?? null);
            }
            else if (!desktop.matches && selection.current)
            {
                const element = document.querySelector<HTMLElement>(`#portfolio-${CSS.escape(selection.current)}`);
                if (element)
                {
                    portfolioCollapse(element)?.show();
                }
            }
        };

        desktop.addEventListener("change", resize);

        return () => desktop.removeEventListener("change", resize);
    }, [winnerId]);

    return (
        <div className="game-results card card-green text-center">
            <header className="results-heading">
                <p>Game finished</p>
                <h1>{`${players[0]?.name ?? ""} wins!`}</h1>
            </header>
            <div className="results-main">
                <ol id="final-portfolios" className="results-leaderboard accordion" aria-label="Final rankings">
                    {players.map((player) => (
                        <li key={player._id} className={`accordion-item ${selectedId === player._id ? "is-selected" : ""}`}>
                            <h2 className="accordion-header" id={`player-heading-${player._id}`}>
                                <button
                                    type="button"
                                    className={`result-player-button accordion-button ${selectedId === player._id ? "" : "collapsed"}`}
                                    aria-expanded={selectedId === player._id}
                                    aria-controls={`desktop-portfolio-${player._id} portfolio-${player._id}`}
                                    onClick={() =>
                                    {
                                        if (matchMedia("(min-width: 992px)").matches)
                                        {
                                            setSelectedId(player._id);
                                        }
                                        else
                                        {
                                            const element = document.querySelector<HTMLElement>(`#portfolio-${CSS.escape(player._id)}`);
                                            if (element)
                                            {
                                                portfolioCollapse(element)?.toggle();
                                            }
                                        }
                                    }}
                                >
                                    <span className="result-rank">{player.ranking}</span>
                                    <img className="rounded" src={player.profileRoot} alt="" />
                                    <span>
                                        <strong>{player.name}</strong>
                                        <span>{`Net worth £${money(player.netWorth)}`}</span>
                                    </span>
                                </button>
                            </h2>
                            <MobilePortfolio
                                board={board}
                                player={player}
                                initiallyOpen={player._id === winnerId}
                                select={setSelectedId}
                            />
                        </li>
                    ))}
                </ol>
                <div className="portfolio-panes tab-content">
                    {players.map((player) => (
                        <section
                            key={player._id}
                            id={`desktop-portfolio-${player._id}`}
                            className={`desktop-player-portfolio tab-pane fade bg-white text-black rounded ${selected?._id === player._id ? "show active" : ""}`}
                            aria-label={`${player.name}'s portfolio`}
                            aria-hidden={selected?._id !== player._id}
                            inert={selected?._id !== player._id}
                        >
                            <h2 className="text-black">{`${player.name}'s portfolio`}</h2>
                            <p>{`Cash £${money(player.cash)} · Stocks worth £${money(player.netWorth - player.cash)}`}</p>
                            <FinalHoldings board={board} player={player} />
                        </section>
                    ))}
                </div>
            </div>
            <StockHistoryStrip board={board} />
            <footer className="results-footer">{onBack ? <button className="btn btn-primary" onClick={onBack}>Go Back</button> : <Link className="btn btn-primary" to="/">Go Back</Link>}</footer>
        </div>
    );
}
