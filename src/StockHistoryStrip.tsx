/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Native scroll regions must be focusable for keyboard browsing. */
import { useRef } from "react";
import { useMarquee } from "./use-marquee";
import { stockHistory } from "./stock-history";
import type { Board, Stock } from "./types";

function HistoryCard({ game, stock }: { game: Board["game"]; stock: Stock })
{
    const history = stockHistory(game, stock.key);

    return (
        <article className="history-card bg-white text-black rounded">
            <div className="history-chart">
                <div>
                    <img src={stock.imagePath} alt="" draggable={false} />
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
    const reference = useRef<HTMLDivElement>(null);
    const stocks = board.stocks.filter((stock) => stock.display);

    useMarquee(reference);

    return (
        <section className="stock-history-strip" aria-label="Final stock price histories">
            <h2 className="visually-hidden">Stock history</h2>
            <div
                ref={reference}
                className="history-viewport overflow-x-auto"
                role="region"
                aria-label="Stock histories; drag or use arrow keys to browse"
                tabIndex={0}
            >
                <div className="history-track d-flex">
                    {[0, 1, 2, 3].map((copy) => (
                        <div className="history-group d-flex gap-3" key={copy} aria-hidden={copy > 0 ? true : undefined}>
                            {stocks.map((stock) => <HistoryCard key={stock.key} game={board.game} stock={stock} />)}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
