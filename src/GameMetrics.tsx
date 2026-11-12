import { gamePeriodCount, gamePeriodNumber, legacyTechRounds, type Pack } from "../shared/packs";

export function GameMetrics({ board }: { board: {
    game: { turn: number; currentPlayerId?: string; currentPeriod: number; periodCount: number; pack?: Pack };
    players: { _id: string; name: string }[]; player?: { _id: string };
} })
{
    const { game, players } = board;
    const currentRound = game.currentPeriod + 1;
    const totalRounds = game.periodCount + 1;
    const period = gamePeriodNumber(game, game.currentPeriod);
    const periods = gamePeriodCount(game);
    const turnUnit = legacyTechRounds(game) ? "round" : "period";
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
                    aria-label={`${owner} goes left this ${turnUnit}: ${remaining} of 3, including this turn`}
                    title={`${owner} goes left this ${turnUnit}: ${remaining} of 3, including this turn`}
                >
                    {[0, 1, 2].map((go) => (
                        <span key={go} className={go < used ? "is-used" : (go === used ? "is-current" : "")} />
                    ))}
                </div>
            </div>
            <div className="game-metric">
                <span className="game-metric-label">Period</span>
                <div className="game-metric-value">
                    <strong>{period}</strong>
                    <span>{`of ${periods}`}</span>
                </div>
                <progress aria-label="Period progress" value={currentRound} max={totalRounds} />
            </div>
        </div>
    );
}
