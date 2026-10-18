import { money } from "./shared";
import { StockResult } from "./RoundReveal";
import type { Board } from "./types";

export function RoundOverview({ before, after }: { before: Board; after: Board })
{
    return (
        <section className="round-overview d-grid gap-3" aria-label="Round overview">
            <h2>Round overview</h2>
            <div className="round-overview-stocks">
                {after.stocks.filter((stock) => stock.display).map((stock) => (
                    <article className="bg-white text-black rounded p-3 text-center" key={stock.key}>
                        <img height={48} src={stock.imagePath} alt="" />
                        <h3 className="text-black">{stock.name}</h3>
                        <StockResult
                            before={before.game.prices.find((price) => price.stockKey === stock.key)?.value ?? 0}
                            after={after.game.prices.find((price) => price.stockKey === stock.key)?.value ?? 0}
                        />
                        {after.game.suspended.includes(stock.key) && <p>Stock price held</p>}
                    </article>
                ))}
            </div>
            <div className="round-overview-players">
                {after.players.toSorted((a, b) => b.netWorth - a.netWorth).map((player) =>
                {
                    const previous = before.players.find((item) => item._id === player._id)?.netWorth ?? 0;
                    const change = player.netWorth - previous;

                    return (
                        <article className="card card-green p-3 text-center" key={player._id}>
                            <img className="rounded mx-auto" height={60} width={60} src={player.profileRoot} alt="" />
                            <h3>{player.name}</h3>
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
