import type { Board } from "./display-types";
import { rightsIssueOrder } from "../shared/rights-issue";
import { SpectatorHeader } from "./SpectatorHeader";
import { Dashboard, Feed } from "./SpectatorDashboard";
import { SpectatorSkip } from "./RightsIssueSkip";
import { spectatorBoard } from "./spectator-board";
import "./spectator/spectator.css";
import "./spectator/tv-display.css";
import "./rights-spectator-desktop.css";

export function RightsIssueSpectatorDesktop({ board, onDecision }: {
    board: Board; onDecision?: (quantity: number) => Promise<unknown>;
})
{
    const issue = board.game.rightsIssue!;
    const playerId = issue.offers[issue.index].playerId;
    const player = board.players.find((item) => item._id === playerId)!;
    const stock = board.stocks.find((item) => item.key === issue.stockKey)!;
    const snapshot = { ...board, game: { ...board.game, turn: issue.turn } };
    const publicBoard = spectatorBoard(snapshot);
    const order = rightsIssueOrder(board.players, issue.actorPlayerId).map((item) => item._id);

    return (
        <div className="web-spectator rights-desktop-spectator">
            <main className="game-screen">
                <SpectatorHeader board={snapshot} paused />
                <div className="game-layout">
                    <Dashboard
                        board={{ ...publicBoard, game: { ...publicBoard.game, currentPlayerId: playerId } }}
                        phoneUrl={globalThis.location?.origin ?? "http://localhost"}
                        portfolioOrder={order}
                        mutedStockKey={stock.key}
                        animateStockKey={stock.key}
                        portfolioNotice={(
                            <div className="rights-portfolio-notice">
                                <img src={player.profileRoot} alt={player.name} />
                                <div>
                                    <h2>Rights Issue</h2>
                                    <p>
                                        {issue.completed ? "Rights Issue complete. Resuming trading…"
                                            : `${player.name} is deciding how much ${stock.name} stock to purchase during the Rights Issue.`}
                                    </p>
                                </div>
                                <img className="rights-notice-stock" src={stock.imagePath} alt={stock.name} />
                            </div>
                        )}
                    />
                    <div className="sidebar">
                        <Feed board={publicBoard} />
                        <div className="spectator-note"><p>Private insights stay on your phone.</p></div>
                        {!issue.completed && <SpectatorSkip key={`${issue.insightId}-${issue.index}`} onDecision={onDecision} />}
                    </div>
                </div>
                <footer>
                    <span>Stockmarket! · Spectator view</span>
                    <span>Gameplay paused during Rights Issue</span>
                </footer>
            </main>
        </div>
    );
}
