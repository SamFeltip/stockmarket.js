import { useConvexAuth, useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useAction } from "../shared";
import { GameResults } from "../GameResults";
import { PlayAnimation } from "../PlayAnimation";
import { Dashboard, Feed } from "./Dashboard";
import { RoundPresentation } from "./RoundPresentation";
import { websiteBoard } from "./presentation";
import { SpectatorLobby } from "./SpectatorLobby";
import type { Board } from "./types";
import "./spectator.css";
import "./tv-display.css";

export function SpectatorScreen({ board }: { board: Board })
{
    const start = useMutation(api.games.start);
    const next = useMutation(api.rounds.next);
    const { run, busy, error } = useAction();
    const { game } = board;
    const phoneUrl = globalThis.location.origin;
    const current = board.players.find((player) => player.id === game.currentPlayerId);
    const display = websiteBoard(board);

    const back = () =>
    {
        globalThis.location.assign("/");
    };

    const totalTurns = board.players.length * 3;
    const status = game.status === "playing"
        ? `${current?.name ?? "Next investor"}’s turn · ${Math.min(game.turn + 1, totalTurns)} / ${totalTurns}`
        : "Market closed · host continues on their display";
    if (game.status === "finished")
    {
        return <main className="tv-results"><GameResults board={display} onBack={back} /></main>;
    }

    if (board.reveal)
    {
        return (
            <>
                <RoundPresentation
                    key={`${game.code}-${game.currentPeriod}`}
                    snapshot={board}
                    canAdvance={board.canControl}
                    busy={busy}
                    error={error}
                    onBack={back}
                    onNext={() =>
                    {
                        void run(() => next({ code: game.code, expectedPeriod: game.currentPeriod }));
                    }}
                />
                <PlayAnimation key={`actions-${game.currentPeriod}`} board={display} />
            </>
        );
    }

    if (game.status === "waiting")
    {
        return (
            <SpectatorLobby
                board={board}
                phoneUrl={phoneUrl}
                busy={busy}
                error={error}
                onStart={() =>
                {
                    void run(() => start({ code: game.code }));
                }}
            />
        );
    }

    return (
        <>
            <main className="game-screen">
                <header className="game-header">
                    <div className="card card-green spectator-heading">
                        <img src="/static/imgs/icons/Stock.svg" alt="" />
                        <div>
                            <h2>Spectator view</h2>
                            <p>{`Lobby: ${game.code.toUpperCase()}`}</p>
                        </div>
                    </div>
                    <div className="card card-green turn-heading">
                        <h3 className="primary">{status}</h3>
                        <p>Public portfolios and market prices</p>
                    </div>
                    <div className="card card-green title-heading">
                        <h1 id="stockmarket-header">Stockmarket!</h1>
                        <p>{`Period ${game.currentPeriod + 1} / ${game.periodCount + 1}`}</p>
                    </div>
                </header>
                <div className="game-layout">
                    <Dashboard board={board} phoneUrl={phoneUrl} />
                    <div className="sidebar">
                        <Feed board={board} />
                        <div className="spectator-note"><p>Private insights stay on your phone.</p></div>
                        <Link className="btn btn-secondary" to="/">Back</Link>
                    </div>
                </div>
                <footer>
                    <span>Stockmarket! · Spectator view</span>
                    <span>Tab to navigate · Enter to select</span>
                </footer>
            </main>
            <PlayAnimation key={`actions-${game.currentPeriod}`} board={display} />
        </>
    );
}

export default function SpectatorPage()
{
    const { code = "" } = useParams();
    const { isLoading } = useConvexAuth();
    const connection = useConvexConnectionState();
    const board = useQuery(api.tv.board, isLoading ? "skip" : { code });
    let screen;
    if (board === undefined)
    {
        screen = (
            <main className="center">
                <h1>Loading game…</h1>
                <Link className="btn btn-secondary" to="/">← Home</Link>
            </main>
        );
    }
    else if (board === null)
    {
        screen = (
            <main className="center">
                <h1>Game not found</h1>
                <p>Check the lobby code. This game may have been removed.</p>
                <Link className="btn btn-primary" to="/">Go back</Link>
            </main>
        );
    }
    else
    {
        screen = <SpectatorScreen key={board.game.code} board={board} />;
    }

    return (
        <div className="web-spectator">
            {screen}
            {!connection.isWebSocketConnected && (
                <div className="connection" role="status">
                    Reconnecting… Live data may be out of date. Check your internet connection.
                </div>
            )}
        </div>
    );
}
