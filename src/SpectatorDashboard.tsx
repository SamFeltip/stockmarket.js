import { priceSeries } from "./price-history";
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
    const history = priceSeries({ ...board.game, prices: [], priceHistory: board.history }, stockKey)
        .filter((point) => point.value !== null);
    const values = history.map((point) => point.value ?? 0);
    if (values.length < 2)
    {
        return <span className="muted">History appears after each period</span>;
    }

    const min = Math.min(...values), max = Math.max(...values);
    const points = history.map((point) =>
        `${2 + point.round / (board.game.periodCount + 1) * 176},${38 - ((point.value ?? 0) - min) / (max - min || 1) * 32}`)
        .join(" ");

    return (
        <svg
            className="sparkline"
            viewBox="0 0 180 44"
            role="img"
            aria-label={`Recorded prices: ${values.map((v) => `£${v.toFixed(2)}`).join(", ")}`}
        >
            <path d="M0 40H180" stroke="#adb5aa" />
            <polyline points={points} stroke="#204712" fill="none" strokeWidth="2.5" />
        </svg>
    );
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
                                    secondaryImagePath: stockLogo(stock.key, stock.imagePath) }))}
                            />
                        </div>
                    </article>
                )) : <p>Game activity will appear here.</p>}
            </div>
        </section>
    );
}

export function Dashboard({ board, phoneUrl, portfolioNotice, portfolioOrder, mutedStockKey, animateStockKey }: {
    board: Board; phoneUrl: string; portfolioNotice?: ReactNode; portfolioOrder?: string[];
    mutedStockKey?: number; animateStockKey?: number;
})
{
    const volatilityOrder = [7, 8, 9, 10, 11, 12];
    const stocks = board.stocks.toSorted((a, b) =>
        (volatilityOrder.indexOf(a.key) + 1 || Infinity) - (volatilityOrder.indexOf(b.key) + 1 || Infinity));
    const ranked = board.players.toSorted((a, b) => b.netWorth - a.netWorth);
    const latest = board.latestPurchase;
    const total = board.players.reduce((sum, player) => sum + player.netWorth, 0);
    const invested = board.players.reduce((sum, player) => sum + player.netWorth - player.cash, 0);
    const finished = board.game.status === "finished";

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
                <p className="table-note">Holdings in shares · Net worth = cash + shares at current prices</p>
            </section>
            <section className="bottom-row">
                <JoinCard code={board.game.code} phoneUrl={phoneUrl} compact />
                <article className="stat card">
                    <h3>{finished ? "Winner" : "Combined wealth"}</h3>
                    <strong>{finished ? ranked[0]?.name ?? "—" : money(total)}</strong>
                    <p>{finished ? money(ranked[0]?.netWorth ?? 0) : `${money(invested)} in shares`}</p>
                </article>
                <article className="latest card">
                    <h3>Latest purchase</h3>
                    <strong>{latest ? latest.title : "No purchases yet"}</strong>
                    <p>{latest ? latest.message : "Purchases appear here as they happen."}</p>
                </article>
            </section>
        </div>
    );
}
