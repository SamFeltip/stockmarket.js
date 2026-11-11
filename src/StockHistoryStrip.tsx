import { Marquee } from "./Marquee";
import { StockHistoryChart } from "./StockHistoryChart";
import { stockHistory } from "./stock-history";
import type { Board, Stock } from "./display-types";

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
                <StockHistoryChart name={stock.name} points={history.points} />
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
    const stocks = board.stocks.filter((stock) => stock.display);

    return (
        <section className="stock-history-strip" aria-label="Final stock price histories">
            <h2 className="visually-hidden">Stock history</h2>
            <Marquee label="Stock histories; drag or use arrow keys to browse">
                {stocks.map((stock) => <HistoryCard key={stock.key} game={board.game} stock={stock} />)}
            </Marquee>
        </section>
    );
}
