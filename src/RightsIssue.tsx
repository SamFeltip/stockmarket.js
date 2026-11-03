import { RightsIssueSpectatorDesktop } from "./RightsIssueSpectatorDesktop";
import { SpectatorSkip } from "./RightsIssueSkip";
import { SpectatorHeader } from "./SpectatorHeader";
import { TradeStockSummary } from "./TradeStockSummary";
import { useState } from "react";
import type { Board } from "./display-types";
import { rightsIssueOrder, rightsIssuePrice, rightsPurchaseError, rightsAvailable } from "../shared/rights-issue";
import { TradeInputs } from "./TradeInputs";
import { TradePosition } from "./TradePosition";
import type { TradeDraft } from "./trades";
import { GameMetrics } from "./GameMetrics";
import { DecisionPortfolios } from "./DecisionPortfolios";
import { NetWorthNumber } from "./RoundWealth";
import { money, useAction } from "./shared";
import "./share-suspended.css";
import "./rights-issue.css";

export function RightsIssue({ board, playerId, spectator = false, onDecision }: {
    board: Board; playerId?: string; spectator?: boolean; onDecision?: (quantity: number) => Promise<unknown>;
})
{
    const issue = board.game.rightsIssue!;
    const stock = board.stocks.find((item) => item.key === issue.stockKey)!;
    const offer = issue.offers[issue.index];
    const current = board.players.find((player) => player._id === offer.playerId)!;
    const own = !spectator && !issue.completed && playerId === current._id;
    const ordered = rightsIssueOrder(board.players, issue.actorPlayerId);

    return (
        <>
            {spectator && <RightsIssueSpectatorDesktop board={board} onDecision={onDecision} />}
            <main className={`rights-screen ${spectator ? "rights-spectator rights-spectator-mobile" : ""} ${own ? "rights-own" : ""}`}>
                <section className="rights-panel" aria-label="Rights Issue">
                    {spectator && (
                        <SpectatorHeader board={{ ...board, game: { ...board.game, turn: issue.turn } }} paused />
                    )}
                    <footer className="rights-progress">
                        <GameMetrics board={{ ...board, game: { ...board.game, turn: issue.turn } }} />
                        <small>Trading paused during Rights Issue</small>
                    </footer>
                    <div className="rights-summary">
                        <header className="suspension-heading">
                            <p>Chance Card</p>
                            <h1>Rights Issue</h1>
                            {own && <p>{`Optionally buy more ${stock.name} shares at £1 per extra share.`}</p>}
                        </header>
                        {own ? (
                            <RightsPurchase key={`${issue.insightId}-${issue.index}`} board={board} onDecision={onDecision} />
                        ) : (
                            <div className="rights-waiting">
                                {spectator && <img className="rights-current rounded" src={current.profileRoot} alt={current.name} />}
                                <img className="rights-company" src={stock.imagePath} alt={stock.name} />
                                <p>
                                    {issue.completed ? "Rights Issue complete. Resuming trading…" : (spectator ? `${current.name} is deciding how much ${stock.name} stock to purchase during the Rights Issue.`
                                        : `Gameplay is paused while ${stock.name} conducts a Rights Issue.`)}
                                </p>
                            </div>
                        )}
                        {spectator && (
                            <DecisionPortfolios
                                board={board}
                                activePlayerId={current._id}
                                order={ordered.map((player) => player._id)}
                                mutedStockKey={stock.key}
                                animateStockKey={stock.key}
                            />
                        )}
                    </div>
                    {spectator ? (
                        <>
                            <div className="rights-stock-prices">
                                {board.stocks.filter((item) => item.display).map((item) => (
                                    <article key={item.key}>
                                        <img src={item.imagePath} alt="" />
                                        <strong>{item.name}</strong>
                                        <span>price</span>
                                        <strong>
                                            {`£${(board.game.prices.find((value) => value.stockKey === item.key)?.value ?? 0).toFixed(2)}`}
                                        </strong>
                                    </article>
                                ))}
                            </div>
                            {!issue.completed && <SpectatorSkip key={`${issue.insightId}-${issue.index}`} onDecision={onDecision} />}
                        </>
                    ) : (
                        <div className="rights-holders" aria-label="Rights Issue shareholders">
                            {issue.offers.map((item) =>
                            {
                                const player = board.players.find((seat) => seat._id === item.playerId)!;
                                const held = player.holdings.find((holding) =>
                                    holding.stockKey === stock.key)?.quantity ?? 0;

                                return (
                                    <div key={item.playerId} className={item.playerId === current._id ? "is-current" : ""}>
                                        <img src={player.profileRoot} alt="" className="rounded" />
                                        <strong>{item.playerId === playerId ? "You" : player.name}</strong>
                                        <NetWorthNumber value={held} shares initialValue={item.held} />
                                        <span>stocks</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>
        </>
    );
}

function RightsPurchase({ board, onDecision }: { board: Board; onDecision?: (quantity: number) => Promise<unknown> })
{
    const issue = board.game.rightsIssue!;
    const offer = issue.offers[issue.index];
    const player = board.players.find((item) => item._id === offer.playerId)!;
    const stock = board.stocks.find((item) => item.key === issue.stockKey)!;
    const [draft, setDraft] = useState<TradeDraft>({ field: "shares", value: "0" });
    const { run, busy, error } = useAction();
    const quantity = draft.value.trim() === "" ? 0 : Number(draft.value);
    const available = rightsAvailable(board.players, issue.stockKey);
    const reason = rightsPurchaseError(quantity, offer.maximum, player.cash)
      || (quantity > available ? "There aren't enough shares available. Try fewer shares." : "");
    const valid = !reason && quantity > 0;
    const limit = Math.min(offer.maximum, Math.floor(player.cash), available);
    const projected = Number.isSafeInteger(quantity) && quantity >= 0 ? quantity : 0;
    const price = board.game.prices.find((item) => item.stockKey === stock.key)?.value ?? 0;
    const setQuantity = (value: number) => setDraft({ field: "shares", value: String(value) });

    return (
        <form
            className="rights-purchase"
            noValidate
            onSubmit={(event) =>
            {
                event.preventDefault();

                if (valid && !busy)
                {
                    void run(async () =>
                    {
                        await onDecision?.(quantity);
                    });
                }
            }}
        >
            <TradeStockSummary
                stock={stock}
                price={rightsIssuePrice}
                priceLabel="Rights Issue price"
                detail={(
                    <small className="text-secondary">
                        {`${price >= rightsIssuePrice ? "−" : "+"}£${Math.abs(price - rightsIssuePrice).toFixed(2)}`}
                    </small>
                )}
            />
            <p className="small rights-limit">{`Maximum: ${money(limit)} shares`}</p>
            <TradeInputs
                shares={draft.value}
                cash={draft.value}
                quantity={quantity}
                limit={limit}
                busy={busy}
                valid={valid}
                feedbackId="rights-purchase-feedback"
                setDraft={setDraft}
                setQuantity={setQuantity}
                resolve={(value) => Number(value.value)}
                step={1}
                increase={(value) => Math.min(limit, Math.floor(value / 1000 + 1) * 1000)}
                decrease={(value) => Math.max(0, Math.ceil(value / 1000 - 1) * 1000)}
            >
                <TradePosition cash={player.cash - projected} holding={offer.held + projected} buying />
            </TradeInputs>
            <p id="rights-purchase-feedback" className={`trade-feedback ${error || reason ? "is-error" : ""}`} role="status">
                {error || reason}
            </p>
            <div className="trade-footer">
                <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() =>
                    {
                        void run(async () =>
                        {
                            await onDecision?.(0);
                        });
                    }}
                >
                    Skip
                </button>
                <button className="btn btn-success" type="submit" disabled={busy || !valid}>Buy</button>
            </div>
        </form>
    );
}
