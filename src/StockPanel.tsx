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
    const startingPrice = game.priceHistory?.find((snapshot) => snapshot.period === 0)?.prices
        .find((item) => item.stockKey === stock.key)?.value ?? stock.startingValue;
    const priceChange = Math.round((price - startingPrice) * 100) / 100;
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
                        <div className="stock-chart-heading">
                            <h4 id="price-chart-title">Price Chart</h4>
                            <span
                                className={`stock-chart-change text-${priceChange > 0 ? "success" : (priceChange < 0 ? "danger" : "secondary")}`}
                                aria-label={`Price change since start: ${priceChange < 0 ? "minus" : "plus"} £${Math.abs(priceChange).toFixed(2)}`}
                            >
                                <svg width="24" height="18" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d={priceChange < 0 ? "M2 3l7 7 4-4 9 9M15 15h7V8" : (priceChange > 0 ? "M2 15l7-7 4 4 9-9M15 3h7v7" : "M2 9h20m-6-6 6 6-6 6")} />
                                </svg>
                                <span>{`£${Math.abs(priceChange).toFixed(2)}`}</span>
                            </span>
                        </div>
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
                            {[[`${stock.variation}/6`, "Volatility"], [money(available), "Shares available"]].map(([number, title]) => (
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
                    <div className="trade-actions">
                        <button id="buy-button" className="btn btn-success" data-bs-toggle="modal" data-bs-target="#buyModal">Buy</button>
                        <button id="sell-button" className="btn btn-danger" data-bs-toggle="modal" data-bs-target="#sellModal">Sell</button>
                        <button id="pass-button" className="btn btn-secondary btn-sm d-lg-none" data-bs-toggle="modal" data-bs-target="#passModal" aria-label="Pass turn" title="Pass turn">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                                <path d="m5 5 9 7-9 7V5Z" />
                                <path d="M19 5v14" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
            <TradeModal key={`${stock.key}-buy`} board={board} stock={stock} mode="buy" />
            <TradeModal key={`${stock.key}-sell`} board={board} stock={stock} mode="sell" />
        </>
    );
}
