import { packPeriods } from "../../shared/packs";
import { SpectatorHeader } from "../SpectatorHeader";
import { RightsIssue } from "../RightsIssue";
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
    const skipRights = useMutation(api.rightsIssue.skip);
    const setLength = useMutation(api.games.setLength);
    const setPack = useMutation(api.games.setPack);
    const start = useMutation(api.games.start);
    const nextSpectator = useMutation(api.rounds.nextSpectator);
    const beginSuspensions = useMutation(api.rounds.beginSuspensions);
    const skipSuspension = useMutation(api.rounds.skipSuspension);
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
    if (game.rightsIssue)
    {
        const issue = game.rightsIssue;

        return (
            <RightsIssue
                board={display}
                spectator
                onDecision={() => skipRights({ code: game.code,
                    insightId: issue.insightId, expectedIndex: issue.index })}
            />
        );
    }

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
                    onBeginSuspensions={beginSuspensions}
                    onSkipSuspension={skipSuspension}
                    busy={busy}
                    error={error}
                    onBack={back}
                    onNext={() =>
                    {
                        void run(() => nextSpectator({ code: game.code, expectedPeriod: game.currentPeriod }));
                    }}
                />
                <PlayAnimation key={`actions-${game.code}`} board={display} />
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
                onPack={(pack) =>
                {
                    void run(() => setPack({ code: game.code, pack }));
                }}
                onLength={(periods) =>
                {
                    void run(() => setLength({ code: game.code, periodCount: periods - 1 }));
                }}
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
                <SpectatorHeader board={display} />
                <header className="game-header legacy-spectator-header">
                    <div className="card card-green spectator-heading">
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
                        <p>{`Period ${packPeriods(game.pack, game.currentPeriod + 1)} / ${packPeriods(game.pack, game.periodCount + 1)}`}</p>
                    </div>
                </header>
                <div className="game-layout">
                    <Dashboard board={board} phoneUrl={phoneUrl} />
                    <div className="sidebar">
                        <Feed board={board} />
                        <Link className="btn btn-secondary" to="/">Back</Link>
                    </div>
                </div>
                <footer>
                    <span>Stockmarket! · Spectator view</span>
                    <span>Tab to navigate · Enter to select</span>
                </footer>
            </main>
            <PlayAnimation key={`actions-${game.code}`} board={display} />
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
