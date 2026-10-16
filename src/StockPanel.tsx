import { Change, Insights } from "./shared";
import { StockPreview } from "./StockPreview";
import { TradeModal } from "./TradeModal";
import type { Board, Stock } from "./types";

export function StockPanel({ board, stock }: { board: Board; stock: Stock })
{
    const { game, player, players, insights, stocks } = board;
    const price = game.prices.find((item) => item.stockKey === stock.key)?.value ?? 0;
    const held = player.holdings.find((item) => item.stockKey === stock.key)?.quantity ?? 0;
    const ownInsights = insights.filter((insight) => insight.stockKey === stock.key);
    const value = ownInsights.reduce((sum, insight) => sum + insight.value, 0);
    const available = 100_000 - players.reduce((sum, seat) => sum
      + (seat.holdings.find((item) => item.stockKey === stock.key)?.quantity ?? 0), 0);
    const myTurn = game.currentUserId === board.user._id;

    return (
        <>
            <div id="game-stock-info" className={`gap-3 flex-fill bg-white text-black rounded-bottom p-3 ${myTurn ? "" : "watching"}`}>
                <div id="stocks" className="rounded p-3 pb-5 d-flex flex-column gap-2 text-center" style={{ backgroundColor: "#EFEFEF" }}>
                    <StockPreview board={board} stock={stock} large />
                    <div>
                        <h4 className="text-black">
                            {held}
                            {" "}
                            Shares held
                        </h4>
                        <p>
                            £
                            {(held * price).toFixed(2)}
                            {" "}
                            stock evaluation
                        </p>
                    </div>
                </div>
                <div id="investors">
                    <h4 className="text-black">Investors</h4>
                    <div className="d-flex flex-row gap-2">
                        {players.filter((seat) => seat.holdings.some((item) =>
                            item.stockKey === stock.key && item.quantity > 0)).map((seat) => (
                            <div className="d-flex flex-column align-items-center" key={seat._id}>
                                <img className="rounded" width={56} src={seat.profileRoot} alt={seat.name} />
                                <p>{seat.holdings.find((item) => item.stockKey === stock.key)?.quantity}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div id="insights" className="d-grid gap-2" style={{ gridTemplateRows: "auto 1fr" }}>
                    <div className="d-flex justify-content-between">
                        <h4 className="text-black">Your Insights</h4>
                        <Change value={value} button />
                    </div>
                    <Insights insights={ownInsights} stocks={stocks} />
                </div>
                <div id="stock-info" className="d-flex flex-column gap-2">
                    <h4 className="text-black">Info</h4>
                    <div className="d-flex flex-column d-sm-grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                        {[[stock.variation, "Volitility"], ["N/A", "Director"], [available, "Shares available"]].map(([number, title]) => (
                            <div className="card flex-fill" key={title}>
                                <div className="card-body text-center">
                                    <p>{number}</p>
                                    <p className="text-secondary">{title}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {myTurn && (
                    <>
                        <button id="buy-button" className="btn btn-success" data-bs-toggle="modal" data-bs-target="#buyModal">Buy</button>
                        <button id="sell-button" className="btn btn-danger" data-bs-toggle="modal" data-bs-target="#sellModal">Sell</button>
                    </>
                )}
            </div>
            <TradeModal key={`${stock.key}-buy`} board={board} stock={stock} mode="buy" />
            <TradeModal key={`${stock.key}-sell`} board={board} stock={stock} mode="sell" />
        </>
    );
}
