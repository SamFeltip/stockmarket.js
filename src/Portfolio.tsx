import { Change, Insights, money } from "./shared";
import type { Board, Player } from "./types";

export function Portfolio({ board, player }: { board: Board; player: Player })
{
    const own = player.userId === board.user._id;
    const stocks = board.stocks.filter((stock) => stock.display);
    const insights = own ? board.insights : [];

    return (
        <div id="player-portfolio" className={`flex-fill p-3 gap-3 ${own ? "is-current-player" : ""}`}>
            <div id="portfolio">
                <h4 className="text-black">Portfolio</h4>
                <div className="p-4 p-sm-0 d-flex flex-row justify-content-between flex-wrap">
                    {stocks.map((stock) => (
                        <div className="d-flex flex-column align-items-center px-4" key={stock.key}>
                            <img height={50} src={stock.imagePath} alt={stock.name} />
                            <p className="text-black">{player.holdings.find((item) => item.stockKey === stock.key)?.quantity ?? 0}</p>
                            {own && (
                                <Change value={insights.filter((insight) => insight.stockKey === stock.key)
                                    .reduce((sum, insight) => sum + insight.value, 0)}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>
            {own && (
                <div id="insights" className="flex-column gap-2">
                    <h4 className="text-black">Your Insights</h4>
                    <Insights insights={insights} stocks={board.stocks} />
                </div>
            )}
            <div id="net-worth" className="gap-2">
                <h4 className="text-black">Net Worth</h4>
                <div id="graph" className="d-flex flex-row gap-3">
                    {[[player.cash, "Cash"], [player.netWorth, "Net Worth"]].map(([value, title]) => (
                        <div className="card flex-fill" key={title}>
                            <div className="card-body text-center d-flex flex-column justify-content-center align-items-center">
                                <p>
                                    £
                                    {money(Number(value))}
                                </p>
                                <p className="text-secondary">{title}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div id="player-info" className="d-flex flex-column gap-2">
                <h4 className="text-black">Info</h4>
                <div id="info-details" className="d-flex flex-column d-sm-grid gap-3">
                    {[[`${player.ranking} / ${board.players.length}`, "Ranking"], ["N/A", "Director"], [player.holdings.reduce((sum, item) => sum + item.quantity, 0), "Total Shares"]].map(([value, title]) => (
                        <div className="card flex-fill" key={title}>
                            <div className="card-body text-center">
                                <p>{value}</p>
                                <p className="text-secondary">{title}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
