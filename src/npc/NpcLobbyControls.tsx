import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { maximumPlayers } from "../../shared/rules";
import { hideDropdown } from "../bootstrap";
import { Alert, useAction } from "../shared";
import { NpcIdentity } from "./NpcIdentity";
import type { Board } from "../types";

type LobbyPlayer = Pick<Board["players"][number], "_id" | "name" | "profileRoot" | "kind" | "npcDifficulty" | "tagline">;
interface LobbyBoard {
    game: Pick<Board["game"], "code"> & Partial<Pick<Board["game"], "hostId">>;
    players: LobbyPlayer[];
    user?: Pick<Board["user"], "_id">;
}

export function NpcLobbyControls({ board, canManage }: { board: LobbyBoard; canManage?: boolean })
{
    const add = useMutation(api.npc.lobby.add);
    const remove = useMutation(api.npc.lobby.remove);
    const setDifficulty = useMutation(api.npc.lobby.setDifficulty);
    const { run, busy, error } = useAction();
    const { game, players, user } = board;
    const host = canManage ?? Boolean(user && user._id === game.hostId);

    return (
        <section className="npc-lobby-roster" aria-label="Lobby players">
            <Alert message={error} />
            <div
                id="player-list"
                className="d-flex flex-wrap justify-content-center align-items-start gap-4 p-2"
            >
                {players.map((player) => (
                    <article
                        className="lobby-player-card"
                        key={player._id}
                        aria-label={player.name}
                    >
                        <div className="lobby-player-portrait">
                            <img src={player.profileRoot} alt={player.name} />
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
                              <div className="dropdown">
                                  <button
                                      type="button"
                                      className="btn bg-dark text-white border-0 dropdown-toggle npc-difficulty-button"
                                      data-bs-toggle="dropdown"
                                      aria-expanded="false"
                                      disabled={busy}
                                      aria-label={`${player.name} difficulty: ${player.npcDifficulty ?? "medium"}`}
                                  >
                                      {player.npcDifficulty ?? "medium"}
                                  </button>
                                  <ul className="dropdown-menu">
                                      {(["easy", "medium", "hard"] as const).map((difficulty) => (
                                          <li key={difficulty}>
                                              <button
                                                  type="button"
                                                  className={`dropdown-item text-capitalize ${player.npcDifficulty === difficulty ? "active" : ""}`}
                                                  disabled={busy}
                                                  onClick={(event) =>
                                                  {
                                                      const toggle = event.currentTarget.closest(".dropdown")
                                                          ?.querySelector<HTMLElement>("[data-bs-toggle='dropdown']");
                                                      if (toggle)
                                                      {
                                                          hideDropdown(toggle);
                                                      }

                                                      void run(() =>
                                                          setDifficulty({
                                                              code: game.code,
                                                              playerId: player._id,
                                                              difficulty,
                                                          }),
                                                      );
                                                  }}
                                              >
                                                  {difficulty}
                                              </button>
                                          </li>
                                      ))}
                                  </ul>
                              </div>
                          ) : (
                              <NpcIdentity player={player} />
                          ))}
                    </article>
                ))}
                {host && players.length < maximumPlayers && (
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
            </div>
        </section>
    );
}
