import { Change } from "./shared";
import type { Board, Stock } from "./types";

export function StockPreview({ board, stock, large = false, active = false }: {
    board: Board;
    stock: Stock;
    large?: boolean;
    active?: boolean;
})
{
    const price = board.game.prices.find((item) => item.stockKey === stock.key)?.value ?? 0;
    const value = board.insights.filter((insight) => insight.stockKey === stock.key)
        .reduce((sum, insight) => sum + insight.value, 0);

    return (
        <div className={`d-flex flex-fill justify-content-between align-items-center ${large ? "flex-row" : "stock-tab-preview"}`}>
            <div className="d-flex flex-row align-items-center gap-2">
                <div>
                    <img
                        className="img-primary w-100"
                        style={{ maxWidth: 30 }}
                        src={large || active ? stock.imagePath : stock.secondaryImagePath}
                        alt={stock.name}
                    />
                </div>
                <p className={large ? "d-block" : "d-none"}>{stock.name}</p>
            </div>
            <div className={`text-end ${large ? "" : "stock-tab-price"}`}>
                <p>
                    £
                    {price.toFixed(2)}
                </p>
                <Change value={value} />
            </div>
        </div>
    );
}
