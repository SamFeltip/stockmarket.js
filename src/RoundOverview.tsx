import { Marquee } from "./Marquee";
import { StockHistoryChart } from "./StockHistoryChart";
import { StockRoleFooter } from "./StockRoleFooter";
import { stockHistory } from "./stock-history";
import { money } from "./shared";
import { StockResult } from "./RoundReveal";
import type { Board, Stock } from "./display-types";

function OverviewStock({ before, after, stock, mobile }: { before: Board; after: Board; stock: Stock; mobile: boolean })
{
    const result = (
        <StockResult
            before={before.game.prices.find((price) => price.stockKey === stock.key)?.value ?? 0}
            after={after.game.prices.find((price) => price.stockKey === stock.key)?.value ?? 0}
        />
    );

    return (
        <article className="bg-white text-black rounded p-3 text-center" aria-label={mobile ? stock.name : undefined}>
            {mobile ? (
                <div className="round-overview-stock-summary">
                    <img src={stock.imagePath} alt="" draggable={false} />
                    <StockHistoryChart name={stock.name} points={stockHistory(after.game, stock.key, true).points} />
                    {result}
                </div>
            ) : (
                <>
                    <img height={48} src={stock.imagePath} alt="" />
                    <h3 className="text-black">{stock.name}</h3>
                    {result}
                </>
            )}
            {after.game.suspended.includes(stock.key) && <p className="round-overview-suspension">Share Suspended · Stock price held</p>}
            <StockRoleFooter board={before} stock={stock} />
        </article>
    );
}

export function RoundOverview({ before, after, layout }: { before: Board; after: Board; layout?: "compact" | "wide" })
{
    const mobile = layout === "compact";
    const stocks = after.stocks.filter((stock) => stock.display);
    const cards = stocks.map((stock) => (
        <OverviewStock key={stock.key} before={before} after={after} stock={stock} mobile={mobile} />
    ));

    return (
        <section className={`round-overview d-grid gap-3${layout ? ` round-overview-${layout}` : ""}`} aria-label="Round overview">
            <h2>{mobile ? "Stock results" : "Round overview"}</h2>
            <div className="round-overview-stocks">
                {mobile && cards.length > 0
                    ? <Marquee label="Stock results. Swipe or use arrow keys to browse">{cards}</Marquee>
                    : cards}
            </div>
            {layout === "wide" && (
                <section className="round-overview-charts" aria-label="Stock price histories">
                    {stocks.map((stock) => (
                        <div className="rounded" key={stock.key}>
                            <img src={stock.imagePath} alt="" />
                            <StockHistoryChart
                                name={stock.name}
                                points={stockHistory(after.game, stock.key, true).points}
                            />
                        </div>
                    ))}
                </section>
            )}
            {mobile && <h2>Player results</h2>}
            <div className="round-overview-players">
                {after.players.toSorted((a, b) => b.netWorth - a.netWorth).map((player) =>
                {
                    const previous = before.players.find((item) => item._id === player._id)?.netWorth ?? 0;
                    const change = player.netWorth - previous;

                    return (
                        <article className="card card-green p-3 text-center" key={player._id}>
                            <img className="rounded mx-auto" height={60} width={60} src={player.profileRoot} alt="" />
                            <h3 title={mobile ? player.name : undefined}>{player.name}</h3>
                            <p>{`Was £${money(previous)}`}</p>
                            <p className={`wealth-change ${change < 0 ? "wealth-loss" : "wealth-gain"}`}>
                                {`${change >= 0 ? "+" : "−"}£${money(Math.abs(change))}`}
                            </p>
                            <h4>{`Now £${money(player.netWorth)}`}</h4>
                            <p>{`Cash £${money(player.cash)}`}</p>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
