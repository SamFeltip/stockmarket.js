import { packs, type Pack } from "../shared/packs";

const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function GameMetrics({ board }: { board: {
    game: { turn: number; currentPlayerId?: string; currentPeriod: number; periodCount: number; pack?: Pack;
        tradingDates?: { from: string; to: string } };
    players: { _id: string; name: string }[]; player?: { _id: string };
} })
{
    const { game, players } = board;
    const current = players.find((player) => player._id === game.currentPlayerId);
    const used = Math.min(3, Math.floor(game.turn / Math.max(1, players.length)));
    const remaining = 3 - used;
    const owner = current?._id === board.player?._id ? "Your" : `${current?.name ?? "Current player"}'s`;

    return (
        <div className="game-metrics">
            <div className="game-metric">
                <span className="game-metric-label">Turn</span>
                <div className="game-metric-value">
                    <strong>{game.turn + 1}</strong>
                    <span>{`of ${players.length * 3}`}</span>
                </div>
                <div
                    className="turn-goes"
                    role="img"
                    aria-label={`${owner} goes left this period: ${remaining} of 3, including this turn`}
                    title={`${owner} goes left this period: ${remaining} of 3, including this turn`}
                >
                    {[0, 1, 2].map((go) => (
                        <span key={go} className={go < used ? "is-used" : (go === used ? "is-current" : "")} />
                    ))}
                </div>
            </div>
            <div className="game-metric">
                <span className="game-metric-label">{game.pack && game.pack !== "classic" ? `${packs[game.pack].name} period` : "Period"}</span>
                <div className="game-metric-value">
                    <strong>{game.currentPeriod + 1}</strong>
                    <span>{`of ${game.periodCount + 1}`}</span>
                </div>
                {game.tradingDates ? (
                    <small className="text-nowrap">{dateLabel.format(new Date(game.tradingDates.to))}</small>
                ) : <progress aria-label="Period progress" value={game.currentPeriod + 1} max={game.periodCount + 1} />}
            </div>
        </div>
    );
}
