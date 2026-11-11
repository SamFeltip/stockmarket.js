import type { Pack } from "../shared/packs";
import { GameMetrics } from "./GameMetrics";
import "./spectator-header.css";

interface HeaderBoard {
    game: { turn?: number; currentPlayerId?: string; currentPeriod: number;
        periodCount: number; pack?: Pack };
    players: { _id: string; name: string; profileRoot?: string }[];
}

export function SpectatorHeader({ board, paused = false }: { board: HeaderBoard; paused?: boolean })
{
    const current = board.players.find((player) => player._id === board.game.currentPlayerId);

    return (
        <header className={`spectator-desktop-header${paused ? "" : " spectator-live-header"}`} aria-label="Spectator game header">
            <div className="spectator-header-player" role="status">
                {current?.profileRoot && <img src={current.profileRoot} alt="" />}
                <div>
                    <p>Current player</p>
                    <strong>{current?.name ?? "—"}</strong>
                </div>
            </div>
            <div className="spectator-header-progress">
                <GameMetrics board={{ ...board, game: { ...board.game, turn: board.game.turn ?? 0 } }} />
                {paused && <small>Gameplay paused during Rights Issue</small>}
            </div>
            <div className="spectator-header-brand">
                <h1>Stockmarket!</h1>
            </div>
        </header>
    );
}
