import { tradingQuote } from "../shared/suspensions";
import { TradeStockSummary } from "./TradeStockSummary";
import { StockInsightChange } from "./StockInsightChange";
import type { Board, Stock } from "./types";

export function StockPreview({ board, stock, large = false, active = false }: {
    board: Board;
    stock: Stock;
    large?: boolean;
    active?: boolean;
})
{
    const price = tradingQuote(board.game, stock.key, board.player._id) ?? 0;
    const change = (
        <StockInsightChange insights={board.insights} stockKey={stock.key} game={board.game} />
    );
    if (large)
    {
        return <TradeStockSummary stock={stock} price={price} detail={change} />;
    }

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
                {change}
            </div>
        </div>
    );
}
