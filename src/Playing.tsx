import { MobileGameActions, GameMetrics } from "./GameStatus";
import { GameHeader, Profile } from "./GameHeader";
import { Feed } from "./Feed";
import { useState } from "react";
import { useMutation } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../convex/_generated/api";
import { Alert, Insights, Modal, money, useAction } from "./shared";
import { StockPanel } from "./StockPanel";
import { StockPreview } from "./StockPreview";
import { Portfolio } from "./Portfolio";
import { NpcTurnStatus } from "./npc/NpcTurnStatus";
import type { Board } from "./types";

export function Playing({ board }: { board: Board })
{
    const { game, players, insights } = board;
    const stocks = board.stocks.filter((stock) => stock.display);
    const [stockKey, setStockKey] = useState(stocks[0]?.key);
    const [playerId, setPlayerId] = useState(board.player._id);
    const [view, setView] = useState<"stocks" | "players">("stocks");
    const play = useMutation(api.trading.play);
    const { run, busy, error } = useAction();
    const own = players.find((player) => player._id === board.player._id);
    const selectedStock = stocks.find((stock) => stock.key === stockKey) ?? stocks[0];
    const selectedPlayer = players.find((player) => player._id === playerId) ?? own;
    const myTurn = game.currentPlayerId === board.player._id;
    const special = insights.filter((insight) => !stocks.some((stock) => stock.key === insight.stockKey));

    return (
        <>
            <div id="game-grid" className="p-3">
                <Profile board={board} view={view} setView={setView} />
                <Modal id="insightModal" title={`Special Insights - ${game.code}`}><div className="modal-body"><Insights insights={special} stocks={board.stocks} /></div></Modal>
                <div id="now-playing" className="position-relative card card-green p-3 rounded d-flex flex-row align-items-center justify-content-center" style={{ backgroundColor: "var(--bs-card-bg)" }}>
                    <div className="now-playing-content">
                        <div className="now-playing-heading">
                            {myTurn ? (
                                <div className="text-center">
                                    <h3 className="primary">It's your turn</h3>
                                </div>
                            )
                                : (
                                    <NpcTurnStatus board={board} />
                                )}
                            {special.length > 0 && (
                                <button id="insightModalButton" className="btn btn-primary position-relative position-lg-absolute" data-bs-toggle="modal" data-bs-target="#insightModal" aria-label="Special insights">
                                    <img height={35} src="/static/imgs/icons/special-insight.svg" alt="special insight" />
                                    <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{special.length}</span>
                                </button>
                            )}
                        </div>
                        <GameMetrics board={board} />
                    </div>
                    <MobileGameActions />
                </div>
                <Modal id="gameModal" title={`Stockmarket! - ${game.code}`}>
                    <div className="modal-body d-flex gap-2">
                        <Link
                            className="btn btn-primary"
                            to="/"
                            onClick={() =>
                            {
                                document.querySelector<HTMLButtonElement>("#gameModal .btn-close")?.click();
                            }}
                        >
                            Leave Game
                        </Link>
                        <Link
                            className="btn btn-secondary"
                            to="/logout"
                            onClick={() =>
                            {
                                document.querySelector<HTMLButtonElement>("#gameModal .btn-close")?.click();
                            }}
                        >
                            Sign out
                        </Link>
                    </div>
                </Modal>
                <GameHeader />
                <div id="content" className="d-grid" style={{ gridTemplateRows: "auto 1fr" }}>
                    <div id="tabs" className="overflow-hidden" style={{ height: 65 }}>
                        <div id="stock-tabs" className={`h-100 w-100 tabs-display-${view === "stocks" ? "center" : "left"}`} inert={view !== "stocks"} aria-hidden={view !== "stocks"}>
                            <ol className="h-100 w-100 position-absolute nav nav-tabs d-flex flex-nowrap justify-content-between">
                                {stocks.map((stock) => (
                                    <li className="nav-item d-flex flex-fill" key={stock.key}>
                                        <button
                                            id={`player-stock-tab-${stock.key}`}
                                            className={`flex-fill player-stock-tab nav-link d-flex flex-row align-items-center justify-content-between ${stock.key === selectedStock?.key ? "active" : ""}`}
                                            onClick={() =>
                                            {
                                                setStockKey(stock.key);
                                            }}
                                        >
                                            <StockPreview
                                                board={board}
                                                stock={stock}
                                                active={stock.key === selectedStock?.key}
                                            />
                                        </button>
                                    </li>
                                ))}
                            </ol>
                        </div>
                        <div id="player-tabs" className={`h-100 w-100 tabs-display-${view === "players" ? "center" : "right"}`} inert={view !== "players"} aria-hidden={view !== "players"}>
                            <ol className="h-100 w-100 position-absolute nav nav-tabs d-flex flex-nowrap justify-content-between">
                                {players.map((player) => (
                                    <li className="nav-item d-flex flex-fill" key={player._id}>
                                        <button
                                            id={`player-tab-${player._id}`}
                                            aria-current={player._id === game.currentPlayerId ? "true" : undefined}
                                            className={`player-tab player nav-link d-flex flex-column flex-lg-row flex-fill align-items-center justify-content-between gap-1 ${player._id === selectedPlayer?._id ? "active" : ""}`}
                                            onClick={() =>
                                            {
                                                setPlayerId(player._id);
                                            }}
                                        >
                                            <div className="d-flex flex-row align-items-center gap-1"><img className="rounded" width={40} src={player.profileRoot} alt={player.name} /></div>
                                            <div className="d-none d-lg-block">
                                                <p>{player.name}</p>
                                                <p>
                                                    £
                                                    {money(player.cash)}
                                                </p>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>
                    <div id="content-wrapper" className="d-flex bg-white text-black rounded-bottom">
                        {view === "stocks" && selectedStock ? <StockPanel board={board} stock={selectedStock} /> : (selectedPlayer ? <Portfolio board={board} player={selectedPlayer} /> : null)}
                    </div>
                </div>
                <Feed board={board} />
                <Modal id="passModal" title="Are you sure you want to pass?">
                    <div className="modal-footer d-flex flex-row">
                        <button type="button" className="btn btn-secondary flex-fill" data-bs-dismiss="modal" disabled={busy}>Cancel</button>
                        <button
                            type="button"
                            className="btn btn-primary flex-fill"
                            disabled={busy || !myTurn}
                            onClick={() =>
                            {
                                if (busy || !myTurn)
                                {
                                    return;
                                }

                                void run(async () =>
                                {
                                    await play({ code: game.code, expectedTurn: game.turn,
                                        expectedPeriod: game.currentPeriod });
                                    document.querySelector<HTMLButtonElement>("#passModal .btn-close")?.click();
                                });
                            }}
                        >
                            Pass
                        </button>
                    </div>
                </Modal>
            </div>
            {error && <div className="game-error"><Alert message={error} /></div>}
        </>
    );
}
