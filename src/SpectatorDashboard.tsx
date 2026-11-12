import type { Pack } from "../shared/packs";
import { packPresentation } from "./pack-presentation";
import { PackIcon } from "./PackIcon";
import "./play-style-card.css";
import { StockHistoryChart } from "./StockHistoryChart";
import { stockHistory } from "./stock-history";
import { RolePortrait } from "./RolePortrait";
import { TradeRoleLabel } from "./TradeRole";
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The feed is a native keyboard scroll region. */
import { PortfolioTable } from "./PortfolioTable";
import { QRCodeSVG } from "qrcode.react";
import type { ReactNode } from "react";
import type { Board } from "./spectator/types";

const joinUrl = (base: string, code: string) => new URL(`/games/show/${encodeURIComponent(code)}`, base).href;

import { asset, portrait, stockLogo } from "./spectator/assets";
import { FeedMessage } from "./FeedMessage";
export const money = (value: number) => new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", maximumFractionDigits: 0,
}).format(value);

const count = (n: number) => new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(n);

function PriceLine({ board, stockKey }: { board: Board; stockKey: number })
{
    const stock = board.stocks.find((item) => item.key === stockKey);
    const game = { ...board.game, prices: stock ? [{ stockKey, value: stock.value }] : [],
        priceHistory: board.history };
    const trades = (board.trades ?? []).map((trade) => ({ ...trade, imageRoot: portrait(trade.imageRoot) }));
    const history = stockHistory(game, stockKey, false, trades, 44);

    return history.markers.length > 1
        ? <StockHistoryChart name={stock?.name ?? "Stock"} history={history} sparkline />
        : <span className="muted">History appears after each period</span>;
}

export function JoinCard({ code, phoneUrl, waiting, compact = false }: {
    code: string; phoneUrl: string; waiting?: boolean; compact?: boolean;
})
{
    return (
        <aside className={`join-card card${compact ? " join-card-compact" : ""}`}>
            {!compact && <h3>{waiting ? "Join game" : "Play on your phone"}</h3>}
            <div className="qr"><QRCodeSVG value={joinUrl(phoneUrl, code)} size={256} level="M" marginSize={4} /></div>
            <div className="join-details">
                <p>{compact ? "Join on your phone" : "Scan the QR code"}</p>
                <strong className="join-code">{code.toUpperCase()}</strong>
                <small>{new URL(phoneUrl).host}</small>
            </div>
        </aside>
    );
}

export function Feed({ board }: { board: Board })
{
    return (
        <section className="activity card" aria-label="Game feed">
            <h2>Feed</h2>
            <div
                role="region"
                className="feed-entries"
                tabIndex={0}
                aria-label="Game feed entries"
            >
                {board.feed.length > 0 ? board.feed.map((item) => (
                    <article key={item.id}>
                        {item.roleAfter ? (
                            <div className="trade-avatar">
                                <RolePortrait
                                    name={item.title}
                                    role={item.roleAfter}
                                    profileRoot={portrait(item.imageRoot)}
                                />
                            </div>
                        ) : (
                            <img
                                className={`feed-avatar${item.colour === "grey" ? " feed-system" : ""}`}
                                src={portrait(item.imageRoot
                                  || board.players.find((player) => player.name === item.title)?.profileRoot)}
                                alt=""
                            />
                        )}
                        <div>
                            <h3>{item.title}</h3>
                            <TradeRoleLabel role={item.roleAfter} />
                            <FeedMessage
                                item={{ ...item, _id: item.id, _creationTime: item.at }}
                                stocks={board.stocks.map((stock) => ({ ...stock, display: true,
                                    imagePath: stockLogo(stock.key, stock.imagePath),
                                    secondaryImagePath: stockLogo(stock.key, stock.secondaryImagePath) }))}
                            />
                        </div>
                    </article>
                )) : <p>Game activity will appear here.</p>}
            </div>
        </section>
    );
}

export function PlayStyleCard({ pack = "classic" }: { pack?: Pack })
{
    return (
        <article className="card bg-white play-style-card">
            <PackIcon pack={pack} />
            <div>
                <h3>Play style</h3>
                <strong>{packPresentation[pack].name}</strong>
            </div>
        </article>
    );
}

export function Dashboard({ board, phoneUrl, portfolioNotice, portfolioOrder, mutedStockKey, animateStockKey }: {
    board: Board; phoneUrl: string; portfolioNotice?: ReactNode; portfolioOrder?: string[];
    mutedStockKey?: number; animateStockKey?: number;
})
{
    const stocks = board.stocks;
    const ranked = board.players.toSorted((a, b) => b.netWorth - a.netWorth);
    const finished = board.game.status === "finished";
    const total = ranked.reduce((sum, player) => sum + player.netWorth, 0);
    const invested = ranked.reduce((sum, player) => sum + player.netWorth - player.cash, 0);

    return (
        <div className="dashboard">
            <section className="market-section">
                <div className="section-heading">
                    <h2>Stocks</h2>
                    <span>Price per share · GBP</span>
                </div>
                <div className="stocks">
                    {stocks.map((stock) =>
                    {
                        const change = stock.value - stock.startingValue;
                        const suspended = board.game.tradingSuspensions?.find((item) => item.stockKey === stock.key);

                        return (
                            <article className="stock card" key={stock.key}>
                                <div className="stock-title">
                                    <img src={stockLogo(stock.key, stock.imagePath)} alt={stock.name} />
                                    <h3>{stock.name}</h3>
                                </div>
                                <div className="price-row">
                                    <strong>
                                        £
                                        {stock.value.toFixed(2)}
                                    </strong>
                                    <span className={change < 0 ? "negative" : "positive"}>
                                        <img src={asset(`/static/imgs/icons/stock_${change < 0 ? "down" : "up"}_black.svg`)} alt={change < 0 ? "Down" : "Up"} />
                                        £
                                        {Math.abs(change).toFixed(2)}
                                    </span>
                                </div>
                                {suspended && (
                                    <p className="stock-footer">{`Suspended price £${suspended.value.toFixed(2)}`}</p>
                                )}
                                <PriceLine board={board} stockKey={stock.key} />
                                <p className="stock-footer">
                                    {count(stock.held)}
                                    {" "}
                                    shares held · change since start
                                </p>
                            </article>
                        );
                    })}
                </div>
            </section>
            <section className="portfolios card" tabIndex={portfolioNotice ? 0 : undefined}>
                {portfolioNotice}
                <div className="section-heading">
                    <h2>{finished ? "Final standings" : "Player portfolios"}</h2>
                    <span>{portfolioOrder ? "In play order" : "Ranked by total wealth"}</span>
                </div>
                <PortfolioTable
                    stocks={stocks.map((stock) => ({ ...stock, imagePath: stockLogo(stock.key, stock.imagePath) }))}
                    players={(portfolioOrder ? board.players.toSorted((a, b) =>
                        portfolioOrder.indexOf(a.id) - portfolioOrder.indexOf(b.id)) : ranked)
                        .map((player) => ({ ...player, profileRoot: portrait(player.profileRoot) }))}
                    activePlayerId={finished ? undefined : board.game.currentPlayerId}
                    mutedStockKey={mutedStockKey}
                    animateStockKey={animateStockKey}
                />
                <p className="table-note">
                    {board.game.tradingSuspensions?.length
                        ? "Holdings in shares · Net worth uses each player’s trading prices"
                        : "Holdings in shares · Net worth = cash + shares at current prices"}
                </p>
            </section>
            <section className="bottom-row">
                <JoinCard code={board.game.code} phoneUrl={phoneUrl} compact />
                {finished && (
                    <article className="stat card">
                        <h3>Winner</h3>
                        <strong>{ranked[0]?.name ?? "—"}</strong>
                        <p>{money(ranked[0]?.netWorth ?? 0)}</p>
                    </article>
                )}
                {!finished && (
                    <>
                        <article className="stat card">
                            <h3>Total net worth</h3>
                            <strong>{money(total)}</strong>
                            <p>{`${money(invested)} in shares`}</p>
                        </article>
                        <PlayStyleCard pack={board.game.pack} />
                    </>
                )}
            </section>
        </div>
    );
}
