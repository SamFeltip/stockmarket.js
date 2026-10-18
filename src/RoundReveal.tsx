import { lazy, Suspense } from "react";
import { Change } from "./shared";
import type { Board, Insight, Stock } from "./types";

const StockPriceChart = lazy(async () => import("./StockPriceChart"));

export function StockResult({ before, after }: { before: number; after: number })
{
    const change = after - before;

    return (
        <div className="stock-result text-center bg-white text-black rounded p-4" aria-live="polite">
            <p>was</p>
            <h2 className="text-black">{`£${before.toFixed(2)}`}</h2>
            <p className={`stock-result-change text-${change > 0 ? "success" : (change < 0 ? "danger" : "secondary")}`}>
                {`${change >= 0 ? "+" : "−"}£${Math.abs(change).toFixed(2)}`}
            </p>
            <p>now</p>
            <h2 className="text-black">{`£${after.toFixed(2)}`}</h2>
        </div>
    );
}

export function RoundReveal({ board, preview, stock, insights, index }: {
    board: Board; preview: Board; stock: Stock; insights: Insight[]; index: number;
})
{
    const special = !stock.display;
    const active = insights[index];
    const sum = insights.slice(0, index + 1).reduce((total, insight) => total + insight.value, 0);
    const before = board.game.prices.find((price) => price.stockKey === stock.key)?.value ?? 0;
    const after = preview.game.prices.find((price) => price.stockKey === stock.key)?.value ?? before;

    return (
        <div className="round-reveal gap-3 h-100 d-grid">
            <div className="p-4 gap-2 rounded d-flex flex-column flex-sm-row justify-content-around align-items-center" style={{ backgroundColor: "#3C5F2F" }}>
                <div className="game-stock-view d-flex flex-column align-items-center">
                    <img className="w-100 p-3" style={{ maxHeight: 180, objectFit: "contain" }} src={stock.imagePath} alt={stock.name} />
                    <h2>{stock.name}</h2>
                </div>
                <div className="d-flex flex-column text-center">
                    <p>{special ? "Change" : "Sum"}</p>
                    <h1 className="fw-bolder">{special ? `${sum * 100}%` : `£${sum.toFixed(2)}`}</h1>
                </div>
            </div>
            {active ? (
                <div key={active._id} className="game-insight-card p-4 gap-2 rounded bg-white text-black d-flex flex-column align-items-center justify-content-center">
                    <img height={120} src={stock.imagePath} alt={stock.name} />
                    {special ? <h2 className="text-black">{`${active.value * 100}%`}</h2> : <Change value={active.value} />}
                    <p>{active.description}</p>
                </div>
            ) : (
                <div className="round-result d-flex flex-column justify-content-center bg-white rounded text-black">
                    {special ? <p className="text-center p-4">All additional insights revealed</p> : <StockResult before={before} after={after} />}
                    {insights.length === 0 && <p className="text-center">No insights for this stock</p>}
                    {board.game.suspended.includes(stock.key) && <p className="text-center">Stock price held</p>}
                </div>
            )}
            {!special && (
                <div className="round-reveal-chart bg-white text-black rounded p-3">
                    <Suspense fallback={<p>Loading price chart…</p>}>
                        <StockPriceChart game={preview.game} stock={stock} />
                    </Suspense>
                </div>
            )}
        </div>
    );
}
