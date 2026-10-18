import { Link } from "react-router-dom";
import { money } from "./shared";
import type { Board } from "./types";

export function GameResults({ board }: { board: Board })
{
    const players = board.players.toSorted((a, b) => b.netWorth - a.netWorth);
    const stocks = board.stocks.filter((stock) => stock.display);

    return (
        <div className="game-results container card card-green p-4 text-center">
            <h1>Game finished</h1>
            <h2>{`${players[0]?.name ?? ""} wins!`}</h2>
            <div className="d-grid gap-3 my-3">
                {players.map((player) => (
                    <article className="bg-white text-black rounded p-3" key={player._id}>
                        <img className="rounded" height={60} width={60} src={player.profileRoot} alt="" />
                        <h3 className="text-black">{`${player.ranking}. ${player.name}`}</h3>
                        <h4 className="text-black">{`Net worth £${money(player.netWorth)}`}</h4>
                        <p>{`Cash £${money(player.cash)}`}</p>
                        <p>{`Stocks worth £${money(player.netWorth - player.cash)}`}</p>
                        <div className="final-holdings">
                            {stocks.map((stock) =>
                            {
                                const quantity = player.holdings.find((holding) =>
                                    holding.stockKey === stock.key)?.quantity ?? 0;
                                const price = board.game.prices.find((item) => item.stockKey === stock.key)?.value ?? 0;

                                return (
                                    <div className="border rounded p-2" key={stock.key}>
                                        <img height={36} src={stock.imagePath} alt="" />
                                        <h5 className="text-black">{stock.name}</h5>
                                        <p>{`${money(quantity)} shares`}</p>
                                        <p>{`£${price.toFixed(2)} per share`}</p>
                                        <p>{`Worth £${money(quantity * price)}`}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </article>
                ))}
            </div>
            <Link className="btn btn-primary" to="/">Go Back</Link>
        </div>
    );
}
