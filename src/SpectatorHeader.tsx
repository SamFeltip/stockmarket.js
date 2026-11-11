import type { Pack } from "../shared/packs";
import { GameMetrics } from "./GameMetrics";
import "./spectator-header.css";

interface HeaderBoard {
    game: { code: string; turn?: number; currentPlayerId?: string; currentPeriod: number;
        periodCount: number; pack?: Pack;
        tradingDates?: { from: string; to: string } };
    players: { _id: string; name: string }[];
}

export function SpectatorHeader({ board, paused = false }: { board: HeaderBoard; paused?: boolean })
{
    const current = board.players.find((player) => player._id === board.game.currentPlayerId);

    return (
        <header className="spectator-desktop-header" aria-label="Spectator game header">
            <div className="spectator-header-lobby">
                <div>
                    <h2>Spectator view</h2>
                    <p>{`Lobby: ${board.game.code.toUpperCase()}`}</p>
                </div>
            </div>
            <div className="spectator-header-progress">
                <GameMetrics board={{ ...board, game: { ...board.game, turn: board.game.turn ?? 0 } }} />
                <small>{paused ? "Gameplay paused during Rights Issue" : `${current?.name ?? "Next investor"}’s turn`}</small>
            </div>
            <div className="spectator-header-brand">
                <h1>Stockmarket!</h1>
            </div>
        </header>
    );
}
