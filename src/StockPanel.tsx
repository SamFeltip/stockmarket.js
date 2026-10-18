import { sharesPerCompany } from "../shared/rules";
import { lazy, Suspense } from "react";
import { Change, Insights, money } from "./shared";
import { StockPreview } from "./StockPreview";
import { Investors } from "./Investors";
import { TradeModal } from "./TradeModal";
import type { Board, Stock } from "./types";

const StockPriceChart = lazy(async () => import("./StockPriceChart"));

export function StockPanel({ board, stock }: { board: Board; stock: Stock })
{
    const { game, player, players, insights, stocks } = board;
    const price = game.prices.find((item) => item.stockKey === stock.key)?.value ?? 0;
    const held = player.holdings.find((item) => item.stockKey === stock.key)?.quantity ?? 0;
    const ownInsights = insights.filter((insight) => insight.stockKey === stock.key);
    const value = ownInsights.reduce((sum, insight) => sum + insight.value, 0);
    const available = sharesPerCompany - players.reduce((sum, seat) => sum
      + (seat.holdings.find((item) => item.stockKey === stock.key)?.quantity ?? 0), 0);
    const myTurn = game.currentPlayerId === board.player._id;

    return (
        <>
            <div id="game-stock-info" className={`flex-fill bg-white text-black rounded-bottom ${myTurn ? "" : "watching"}`}>
                <div className="stock-panel-sections">
                    <section id="stocks" className="stock-holding" aria-label={`Your ${stock.name} shares`}>
                        <div className="stock-mobile-price"><StockPreview board={board} stock={stock} large /></div>
                        <div className="stock-holding-summary">
                            <h4>
                                {money(held)}
                                {" Shares held"}
                            </h4>
                            <p>{`Worth £${money(held * price)}`}</p>
                        </div>
                    </section>
                    <Investors players={players} stockKey={stock.key} />
                    <section id="price-chart" aria-labelledby="price-chart-title">
                        <h4 id="price-chart-title">Price Chart</h4>
                        <Suspense fallback={<div className="stock-price-chart" role="status">Loading price chart…</div>}>
                            <StockPriceChart game={game} stock={stock} />
                        </Suspense>
                    </section>
                    <div id="insights" className="d-grid gap-2">
                        <div className="d-flex justify-content-between">
                            <h4 className="text-black">Your Insights</h4>
                            <Change value={value} button />
                        </div>
                        <Insights insights={ownInsights} stocks={stocks} />
                    </div>
                    <div id="stock-info" className="d-flex flex-column gap-2">
                        <h4 className="text-black">Info</h4>
                        <div className="stock-info-cards">
                            {[[`${stock.variation}/6`, "Volatility"], ["N/A", "Director"], [money(available), "Shares available"]].map(([number, title]) => (
                                <div className="card flex-fill" key={title}>
                                    <div className="card-body text-center">
                                        <p>{number}</p>
                                        <p className="text-secondary">{title}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
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
