import { GameHeader, Profile } from "./GameHeader";
import { FeedMessage } from "./FeedMessage";
import { Feed } from "./Feed";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../convex/_generated/api";
import { Alert, Insights, Modal, money, useAction } from "./shared";
import { StockPanel } from "./StockPanel";
import { StockPreview } from "./StockPreview";
import { Portfolio } from "./Portfolio";
import type { Board } from "./types";

export function Playing({ board }: { board: Board })
{
    const { game, user, players, feed, insights } = board;
    const stocks = board.stocks.filter((stock) => stock.display);
    const [stockKey, setStockKey] = useState(stocks[0]?.key);
    const [playerId, setPlayerId] = useState(board.player._id);
    const [view, setView] = useState<"stocks" | "players">("stocks");
    const play = useMutation(api.trading.play);
    const { run, busy, error } = useAction();
    const own = players.find((player) => player._id === board.player._id);
    const selectedStock = stocks.find((stock) => stock.key === stockKey) ?? stocks[0];
    const selectedPlayer = players.find((player) => player._id === playerId) ?? own;
    const myTurn = game.currentUserId === user._id;
    const special = insights.filter((insight) => !stocks.some((stock) => stock.key === insight.stockKey));
    const [notification, setNotification] = useState<Board["feed"][number] | null>(null);
    const lastFeedId = useRef(feed[0]?._id);
    const latest = feed[0];

    useEffect(() =>
    {
        if (!latest || latest._id === lastFeedId.current)
        {
            return;
        }

        lastFeedId.current = latest._id;
        const show = setTimeout(() =>
        {
            setNotification(latest);
        }, 0);
        const hide = setTimeout(() =>
        {
            setNotification(null);
        }, 2500);

        return () =>
        {
            clearTimeout(show);
            clearTimeout(hide);
        };
    }, [latest]);

    return (
        <>
            <div id="game-grid" className="p-3" style={{ opacity: notification ? 0.2 : 1 }}>
                <Profile board={board} view={view} setView={setView} />
                <Modal id="insightModal" title={`Special Insights - ${game.code}`}><div className="modal-body"><Insights insights={special} stocks={board.stocks} /></div></Modal>
                <div id="now-playing" className="position-relative card card-green p-3 rounded d-flex flex-row align-items-center justify-content-center" style={{ backgroundColor: "var(--bs-card-bg)" }}>
                    {myTurn ? (
                        <div className="text-center">
                            <h3 className="primary">It's your turn</h3>
                            <p className="d-none d-sm-block">Buy, sell, use or pass</p>
                        </div>
                    )
                        : (
                            <h3>
                                It's
                                {players.find((player) => player.userId === game.currentUserId)?.name}
                                's turn!
                            </h3>
                        )}
                    {special.length > 0 && (
                        <button id="insightModalButton" className="btn btn-primary position-relative position-lg-absolute" data-bs-toggle="modal" data-bs-target="#insightModal" aria-label="Special insights">
                            <img height={35} src="/static/imgs/icons/special-insight.svg" alt="special insight" />
                            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{special.length}</span>
                        </button>
                    )}
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
                <GameHeader board={board} />
                <div id="content" className="d-grid" style={{ gridTemplateRows: "auto 1fr" }}>
                    <div id="tabs" className="overflow-hidden" style={{ height: 65 }}>
                        <div id="stock-tabs" className={`h-100 tabs-display-${view === "stocks" ? "center" : "left"}`}>
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
                        <div id="player-tabs" className={`h-100 w-100 position-relative tabs-display-${view === "players" ? "center" : "right"}`} style={{ top: "-100%" }}>
                            <ol className="h-100 w-100 position-absolute nav nav-tabs d-flex flex-nowrap justify-content-between">
                                {players.map((player) => (
                                    <li className="nav-item d-flex flex-fill" key={player._id}>
                                        <button
                                            id={`player-tab-${player._id}`}
                                            className={`player-tab player nav-link d-flex flex-column flex-sm-row flex-fill align-items-center justify-content-between gap-1 ${player._id === selectedPlayer?._id ? "active" : ""}`}
                                            onClick={() =>
                                            {
                                                setPlayerId(player._id);
                                            }}
                                        >
                                            <div className="d-flex flex-row align-items-center gap-1"><img className="rounded" width={40} src={player.profileRoot} alt={player.name} /></div>
                                            <div className="d-none d-sm-block">
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
                <Feed
                    board={board}
                    busy={busy}
                    onPass={() =>
                    {
                        void run(() => play({ code: game.code, expectedTurn: game.turn }));
                    }}
                />
            </div>
            {error && <div className="game-error"><Alert message={error} /></div>}
            {notification && (
                <div id="play-notif" style={{ pointerEvents: "none" }}>
                    <div className="p-3 d-flex justify-content-center flex-column align-items-center position-absolute top-0 bottom-0 start-0 end-0">
                        <img className="rounded bg-secondary" src={notification.imageRoot} height={300} width={300} alt="profile" />
                        <div className="text-center">
                            <h1>{notification.title}</h1>
                            <FeedMessage item={notification} stocks={board.stocks} />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
