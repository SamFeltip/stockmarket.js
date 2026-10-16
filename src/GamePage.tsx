import { gameLengths, minimumPlayers } from "../shared/rules";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../convex/_generated/api";
import { Alert, Loading, useAction } from "./shared";
import { JoinError } from "./JoinError";
import { Playing } from "./Playing";
import { RoundEnd } from "./RoundEnd";
import type { Board } from "./types";

function Waiting({ board }: { board: Board })
{
    const setLength = useMutation(api.games.setLength);
    const start = useMutation(api.games.start);
    const leave = useMutation(api.games.leave);
    const navigate = useNavigate();
    const { run, busy, error } = useAction();
    const { game, players, user } = board;
    const host = game.hostId === user._id;

    return (
        <main className="position-relative overflow-x-hidden d-flex flex-column justify-content-center">
            <div className="container-fluid rounded text-center d-flex flex-column justify-content-center" style={{ width: "95vw", height: "95vh" }}>
                <Alert message={error} />
                <p>Lobby code:</p>
                <h2 className="primary">{game.code}</h2>
                <p>
                    Waiting for players to join (
                    {players.length}
                    {" "}
                    / 6)
                </p>
                <div style={{ minHeight: "11em" }} id="player-list" className="d-flex flex-row justify-content-center gap-3 p-2">
                    {players.map((player) => (
                        <div className="card card-green" key={player._id}>
                            <img
                                className="rounded card-img-top"
                                style={{ objectFit: "cover", maxWidth: "7.5em", maxHeight: "7.5em", height: "auto", width: "auto" }}
                                src={player.profileRoot}
                                alt={player.name}
                            />
                            <div className="card-body"><h3>{player.name}</h3></div>
                        </div>
                    ))}
                </div>
                <div className="py-3">
                    <p className="pb-2">Game length</p>
                    {host ? (
                        <div className="radio-row" id="difficulty-options-setter">
                            {gameLengths.map((periods) => (
                                <span key={periods}>
                                    <input
                                        type="radio"
                                        className="btn-check"
                                        name="game-length"
                                        id={`option${periods}`}
                                        checked={game.periodCount === periods - 1}
                                        disabled={busy}
                                        onChange={() =>
                                        {
                                            void run(() => setLength({ code: game.code, periodCount: periods - 1 }));
                                        }}
                                    />
                                    <label className="btn bg-dark" htmlFor={`option${periods}`}>{`${periods} periods`}</label>
                                </span>
                            ))}
                        </div>
                    )
                        : <div className="btn bg-dark" id="game-difficulty">{`${game.periodCount + 1} periods`}</div>}
                </div>
                <div className="py-3">
                    <p className="pb-2">{players.length < minimumPlayers ? "At least two players are required" : "Launch game when all players have joined"}</p>
                    <div id="game-actions" className="d-flex flex-row w-100 justify-content-center gap-3">
                        <button
                            className="btn btn-secondary w-100"
                            style={{ maxWidth: "14rem" }}
                            disabled={busy}
                            onClick={() =>
                            {
                                void run(async () =>
                                {
                                    await leave({ code: game.code });
                                    await navigate("/");
                                });
                            }}
                        >
                            Back
                        </button>
                        {host && (
                            <button
                                className="btn btn-primary w-100"
                                style={{ maxWidth: "14rem" }}
                                disabled={busy || players.length < minimumPlayers}
                                onClick={() =>
                                {
                                    void run(() => start({ code: game.code }));
                                }}
                            >
                                Launch Game
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}

function ConnectedGame({ code }: { code: string })
{
    const board = useQuery(api.board.get, { code });
    if (!board)
    {
        return <Loading />;
    }

    if (board.game.status === "waiting")
    {
        return <Waiting board={board} />;
    }

    return (
        <main className="position-relative overflow-x-hidden d-flex flex-column justify-content-center">
            {board.game.status === "playing" ? <Playing board={board} />
                : <RoundEnd key={`${board.game.currentPeriod}-${board.game.status}`} board={board} />}
        </main>
    );
}

export function GamePage()
{
    const { code = "" } = useParams();
    const join = useMutation(api.games.join);
    const [joined, setJoined] = useState("");
    const [error, setError] = useState<unknown>(null);

    useEffect(() =>
    {
        let cancelled = false;

        void join({ code }).then(() =>
        {
            if (!cancelled)
            {
                setJoined(code);
            }
        })
            .catch((error_: unknown) =>
            {
                if (!cancelled)
                {
                    setError(error_);
                }
            });

        return () =>
        {
            cancelled = true;
        };
    }, [code, join]);

    if (error)
    {
        return <JoinError error={error} code={code} />;
    }

    return joined === code ? <ConnectedGame code={code} /> : <Loading />;
}
