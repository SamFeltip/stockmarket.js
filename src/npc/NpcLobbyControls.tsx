import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { maximumPlayers } from "../../shared/rules";
import { roster } from "../../../stockmarket-shared/src/npc-catalog";
import { Alert, useAction } from "../shared";
import { NpcIdentity } from "./NpcIdentity";
import type { Board } from "../types";

type LobbyPlayer = Pick<Board["players"][number], "_id" | "name" | "profileRoot" | "kind" | "npcDifficulty" | "tagline">
  & { npcPersonality?: string };
interface LobbyBoard {
    game: Pick<Board["game"], "code"> & Partial<Pick<Board["game"], "hostId">>;
    players: LobbyPlayer[];
    user?: Pick<Board["user"], "_id">;
}

export function NpcLobbyControls({ board, canManage }: { board: LobbyBoard; canManage?: boolean })
{
    const add = useMutation(api.npc.lobby.add);
    const remove = useMutation(api.npc.lobby.remove);
    const setPersonality = useMutation(api.npc.lobby.setPersonality);
    const setDifficulty = useMutation(api.npc.lobby.setDifficulty);
    const { run, busy, error } = useAction();
    const { game, players, user } = board;
    const host = canManage ?? Boolean(user && user._id === game.hostId);
    const canAdd = host && players.length < maximumPlayers;
    const emptySeats = Math.max(0, maximumPlayers - players.length - Number(canAdd));

    return (
        <section className="npc-lobby-roster" aria-label="Lobby players">
            <Alert message={error} />
            <div
                id="player-list"
                className="npc-lobby-grid"
            >
                {players.map((player) => (
                    <article
                        className="lobby-player-card"
                        key={player._id}
                        aria-label={player.name}
                    >
                        <div className="lobby-player-portrait">
                            {host && player.kind === "npc" ? (
                                <button
                                    type="button"
                                    className="npc-personality-button"
                                    aria-label={`Change ${player.name} personality`}
                                    title="Change NPC personality"
                                    disabled={busy}
                                    onClick={() =>
                                    {
                                        const index = roster.findIndex((entry) => entry.id === player.npcPersonality
                                          || entry.name === player.name);
                                        const personality = roster[(index + 1) % roster.length].id;

                                        void run(() => setPersonality({ code: game.code,
                                            playerId: player._id, personality }));
                                    }}
                                >
                                    <img src={player.profileRoot} alt={player.name} />
                                </button>
                            ) : <img src={player.profileRoot} alt={player.name} />}
                            {host && player.kind === "npc" && (
                                <button
                                    type="button"
                                    className="npc-remove-button bg-dark"
                                    aria-label={`Remove ${player.name}`}
                                    disabled={busy}
                                    onClick={() =>
                                    {
                                        void run(() =>
                                            remove({ code: game.code, playerId: player._id }),
                                        );
                                    }}
                                >
                                    <span aria-hidden="true">×</span>
                                </button>
                            )}
                        </div>
                        <h3>{player.name}</h3>
                        {player.kind === "npc"
                          && (host ? (
                              <div className="npc-lobby-settings">
                                  <select
                                      className="form-select bg-dark text-white border-0 npc-difficulty-button"
                                      aria-label={`${player.name} difficulty: ${player.npcDifficulty ?? "medium"}`}
                                      value={player.npcDifficulty ?? "medium"}
                                      disabled={busy}
                                      onChange={(event) =>
                                      {
                                          const difficulty = event.target.value as "easy" | "medium" | "hard";

                                          void run(() => setDifficulty({ code: game.code,
                                              playerId: player._id, difficulty }));
                                      }}
                                  >
                                      <optgroup label="Difficulty">
                                          <option value="easy">Easy</option>
                                          <option value="medium">Medium</option>
                                          <option value="hard">Hard</option>
                                      </optgroup>
                                  </select>
                              </div>
                          ) : (
                              <NpcIdentity player={player} />
                          ))}
                    </article>
                ))}
                {canAdd && (
                    <button
                        type="button"
                        className="npc-add-tile bg-dark"
                        disabled={busy}
                        onClick={() =>
                        {
                            void run(() => add({ code: game.code }));
                        }}
                    >
                        <span aria-hidden="true">+</span>
                        <span>Add NPC</span>
                    </button>
                )}
                {Array.from({ length: emptySeats }, (_, index) => (
                    <div className="lobby-empty-seat" aria-hidden="true" key={maximumPlayers - index} />
                ))}
            </div>
        </section>
    );
}
