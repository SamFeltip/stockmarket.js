import { PackControl } from "../PackControl";
import { GameLengthControl } from "../GameLengthControl";
import { packPeriods, type Pack } from "../../shared/packs";
import { Link } from "react-router-dom";
import { Alert } from "../shared";
import { JoinCard } from "./Dashboard";
import { NpcLobbyControls } from "../npc/NpcLobbyControls";
import type { Board } from "./types";

export function SpectatorLobby({ board, phoneUrl, busy, error, onStart, onPack, onLength }: {
    board: Board; phoneUrl: string; busy: boolean; error: string; onStart: () => void; onPack: (pack: Pack) => void;
    onLength: (periods: number) => void;
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
                    <NpcLobbyControls
                        canManage={board.canControl}
                        board={{
                            game: { code: game.code },
                            players: board.players.map(({ id, ...player }) => ({ ...player, _id: id })),
                        }}
                    />
                    {board.players.length === 0 && <p className="lobby-hint">Scan to join the game or add NPCs.</p>}
                    <PackControl pack={game.pack} busy={busy} onChange={board.canControl ? onPack : undefined} />
                    <div className="game-length">
                        <p>Game length</p>
                        {board.canControl ? (
                            <GameLengthControl
                                pack={game.pack}
                                periods={packPeriods(game.pack, game.periodCount + 1)}
                                busy={busy}
                                onChange={onLength}
                            />
                        ) : (
                            <span className="length-value bg-dark rounded">{`${packPeriods(game.pack, game.periodCount + 1)} periods`}</span>
                        )}
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
