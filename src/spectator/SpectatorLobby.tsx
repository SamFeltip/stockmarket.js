import { Link } from "react-router-dom";
import { Alert } from "../shared";
import { JoinCard } from "./Dashboard";
import { portrait } from "./assets";
import type { Board } from "./types";

export function SpectatorLobby({ board, phoneUrl, busy, error, onStart }: {
    board: Board; phoneUrl: string; busy: boolean; error: string; onStart: () => void;
})
{
    const { game } = board;

    return (
        <main className="website-lobby">
            <div className="container-fluid rounded lobby-surface">
                <section className="lobby-main">
                    <p>Lobby code:</p>
                    <h2 className="primary lobby-code">{game.code}</h2>
                    <p>{`Waiting for players to join (${board.players.length} / 6)`}</p>
                    <div className="lobby-roster" aria-label="Lobby players">
                        {board.players.map((player) => (
                            <article className="lobby-player-card" key={player.id}>
                                <div className="lobby-player-portrait"><img src={portrait(player.profileRoot)} alt={player.name} /></div>
                                <h3>{player.name}</h3>
                            </article>
                        ))}
                        {board.players.length === 0 && (
                            <div className="empty-lobby bg-dark rounded">
                                <img src="/static/imgs/icons/Handshake.svg" alt="" />
                                <p>Scan to join the game</p>
                            </div>
                        )}
                    </div>
                    <div className="game-length">
                        <p>Game length</p>
                        <span className="length-value bg-dark rounded">{`${game.periodCount + 1} periods`}</span>
                    </div>
                    <Alert message={error} />
                    <div className="lobby-actions">
                        <Link className="btn btn-secondary" to="/">Back</Link>
                        {board.canControl && (
                            <button className="btn btn-primary" disabled={busy || board.players.length < 4} onClick={onStart}>
                                {busy ? "Starting…" : "Launch Game"}
                            </button>
                        )}
                    </div>
                    <p className="lobby-hint">{board.canControl ? "Minimum 4 players required" : "The host can launch the game on their display."}</p>
                </section>
                <div className="lobby-join">
                    <JoinCard code={game.code} phoneUrl={phoneUrl} waiting />
                    <p>Join on your phone. The game creator hosts without taking a player seat.</p>
                </div>
                <div className="lobby-footer">
                    <span className="website-title">Stockmarket!</span>
                    <span>Tab to navigate · Enter to select</span>
                </div>
            </div>
        </main>
    );
}
