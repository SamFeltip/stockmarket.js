import { money } from "./shared";
import type { Board, Player } from "./types";

export function FinalHoldings({ board, player }: { board: Board; player: Player })
{
    const stocks = board.stocks.filter((stock) => stock.display);

    return (
        <div className="final-holdings">
            {stocks.map((stock) =>
            {
                const quantity = player.holdings.find((holding) => holding.stockKey === stock.key)?.quantity ?? 0;
                const price = board.game.prices.find((item) => item.stockKey === stock.key)?.value ?? 0;

                return (
                    <article
                        className={`final-holding border rounded ${quantity === 0 ? "unowned" : ""}`}
                        key={stock.key}
                        aria-label={stock.name}
                    >
                        <div>
                            <img src={stock.imagePath} alt="" />
                            <h3 className="text-black">{stock.name}</h3>
                        </div>
                        <div>
                            <p>{`${money(quantity)} shares`}</p>
                            <p>{`Worth £${money(quantity * price)}`}</p>
                            <p className="final-share-price">{`£${price.toFixed(2)} per share`}</p>
                        </div>
                    </article>
                );
            })}
            {player.holdings.every((holding) => holding.quantity === 0)
              && <p className="mobile-empty-portfolio">No shares held</p>}
        </div>
    );
}
