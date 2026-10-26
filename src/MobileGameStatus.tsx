import { HeaderIcon } from "./GameHeader";
import type { Board } from "./types";

export function MobileGameMetrics({ board }: { board: Board })
{
    const { game, players } = board;
    const current = players.find((player) => player._id === game.currentPlayerId);
    const used = Math.min(3, Math.floor(game.turn / Math.max(1, players.length)));
    const remaining = 3 - used;
    const owner = current?._id === board.player._id ? "Your" : `${current?.name ?? "Current player"}'s`;

    return (
        <div className="mobile-game-metrics d-sm-none">
            <div className="mobile-game-metric">
                <span className="mobile-game-metric-label">Turn</span>
                <div className="mobile-game-metric-value">
                    <strong>{game.turn + 1}</strong>
                    <span>{`of ${players.length * 3}`}</span>
                </div>
                <div
                    className="mobile-turn-goes"
                    role="img"
                    aria-label={`${owner} goes left this period: ${remaining} of 3, including this turn`}
                    title={`${owner} goes left this period: ${remaining} of 3, including this turn`}
                >
                    {[0, 1, 2].map((go) => (
                        <span key={go} className={go < used ? "is-used" : (go === used ? "is-current" : "")} />
                    ))}
                </div>
            </div>
            <div className="mobile-game-metric">
                <span className="mobile-game-metric-label">Period</span>
                <div className="mobile-game-metric-value">
                    <strong>{game.currentPeriod + 1}</strong>
                    <span>{`of ${game.periodCount + 1}`}</span>
                </div>
                <progress aria-label="Period progress" value={game.currentPeriod + 1} max={game.periodCount + 1} />
            </div>
        </div>
    );
}

export function MobileGameActions()
{
    return (
        <div className="mobile-game-actions d-flex d-sm-none">
            <button
                type="button"
                data-bs-toggle="modal"
                data-bs-target="#gameModal"
                aria-label="Game menu"
                title="Game menu"
            >
                <HeaderIcon menu />
            </button>
            <button
                type="button"
                data-bs-toggle="offcanvas"
                data-bs-target="#offcanvasResponsive"
                aria-label="Feed"
                title="Activity feed"
            >
                <HeaderIcon />
            </button>
        </div>
    );
}
