import { useState } from "react";
import { stockHistory } from "./stock-history";
import type { Board, Stock } from "./types";

function HistoryCard({ game, stock }: { game: Board["game"]; stock: Stock })
{
    const history = stockHistory(game, stock.key);

    return (
        <article className="history-card bg-white text-black rounded">
            <div className="history-chart">
                <div>
                    <img src={stock.imagePath} alt="" />
                    <h3>{stock.name}</h3>
                </div>
                <svg viewBox="0 0 180 60" role="img" aria-label={`${stock.name} price over all rounds`}>
                    <path d="M4 0V56H180" fill="none" stroke="#a8b2a4" />
                    <polyline points={history.points} fill="none" stroke="#378dde" strokeWidth="2" />
                </svg>
            </div>
            <dl className="history-stats">
                {[["Starting value", history.start], ["Max value", history.max], ["Min value", history.min]].map(([label, value]) => (
                    <div key={label}>
                        <dd>{`£${Number(value).toFixed(2)}`}</dd>
                        <dt>{label}</dt>
                    </div>
                ))}
            </dl>
        </article>
    );
}

export function StockHistoryStrip({ board }: { board: Board })
{
    const [paused, setPaused] = useState(false);
    const stocks = board.stocks.filter((stock) => stock.display);

    return (
        <section className="stock-history-strip" aria-label="Final stock price histories">
            <div className="history-strip-controls">
                <h2>Stock history</h2>
                <button
                    type="button"
                    className="btn btn-outline-light"
                    aria-pressed={paused}
                    onClick={() => setPaused((current) => !current)}
                >
                    {paused ? "Resume charts" : "Pause charts"}
                </button>
            </div>
            <div className="history-viewport" aria-label="Stock histories">
                <div className={`history-track ${paused ? "is-paused" : ""}`}>
                    {[0, 1].map((copy) => (
                        <div className="history-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
                            {stocks.map((stock) => <HistoryCard key={stock.key} game={board.game} stock={stock} />)}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
