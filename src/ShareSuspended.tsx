import { DecisionPortfolios } from "./DecisionPortfolios";
import { hasTargetedSuspension, sharesHeld, stockholders } from "../shared/suspensions";
import { rulesForPack } from "../shared/packs";
import { SuspensionStock } from "./SuspensionStock";
import { useState } from "react";
import { SuspensionSkipConfirmation } from "./SuspensionSkipConfirmation";
import { previewRound } from "./round-preview";
import type { Board, Insight, Player } from "./display-types";
import "./share-suspended.css";

export function ShareSuspended({ board, card, own = false, spectator = false, busy = false, error = "", onDecision }: {
    board: Board; card: Insight; own?: boolean; spectator?: boolean; busy?: boolean; error?: string;
    onDecision?: (stockKey?: number, playerIds?: Player["_id"][]) => Promise<boolean>;
})
{
    const [selected, setSelected] = useState<number>();
    const [confirmSkip, setConfirmSkip] = useState(false);
    const [targetIds, setTargetIds] = useState<Player["_id"][]>([]);
    const { targetedSuspensions } = rulesForPack(board.game.pack);
    const owner = board.players.find((player) => player._id === card.playerId);
    const showPreview = own || spectator || targetedSuspensions || owner?.kind === "npc";
    const stocks = board.stocks.filter((stock) => stock.display);
    const preview = previewRound(board, board.insights, stocks.map((stock) => stock.key));

    const holdersFor = (stockKey: number) => stockholders(board.players, stockKey);
    const suspendedFor = (stockKey: number, playerId: string) =>
        hasTargetedSuspension(board.game.targetedSuspensions, stockKey, playerId);
    const checkedIds = selected === undefined ? [] : holdersFor(selected).filter((player) =>
        targetIds.includes(player._id) && !suspendedFor(selected, player._id)).map((player) => player._id);

    const className = ["suspension-panel", spectator && "suspension-spectator", targetedSuspensions && "targeted-suspension"]
        .filter(Boolean).join(" ");

    return (
        <section className={className} aria-label="Share Suspended decision">
            <div className="suspension-summary">
                <header className="suspension-heading">
                    <p>Chance Card</p>
                    <h1>Share Suspended</h1>
                    {own && (
                        <p>
                            {targetedSuspensions ? "Tap the portraits of the shareholders you want to suspend for that stock."
                                : "Choose a stock price to suspend. Its new valuation will be removed."}
                        </p>
                    )}
                </header>
                {!own && (
                    <div className="suspension-waiting" role="status">
                        <img className="rounded" src={owner?.profileRoot} alt={owner?.name ?? "Player"} />
                        <p>{`${owner?.name ?? "The player"} is deciding which stock valuation to suspend`}</p>
                    </div>
                )}
                {spectator && (
                    <DecisionPortfolios board={{ ...board, players: preview.players }} activePlayerId={card.playerId} />
                )}
            </div>
            {showPreview && (
                <div className="suspension-stocks" role={own && !targetedSuspensions ? "radiogroup" : "group"} aria-label="Stock valuations">
                    {stocks.map((stock) => (
                        <SuspensionStock
                            key={stock.key}
                            stock={stock}
                            spectator={spectator}
                            quantity={sharesHeld(owner, stock.key)}
                            holders={own || targetedSuspensions ? holdersFor(stock.key) : undefined}
                            targeting={targetedSuspensions ? {
                                checked: selected === stock.key ? checkedIds : [],
                                suspended: (playerId) => suspendedFor(stock.key, playerId),
                                toggle: own ? (playerId, checked) =>
                                {
                                    const previous = selected === stock.key ? checkedIds : [];
                                    const next = checked ? [...previous, playerId]
                                        : previous.filter((id) => id !== playerId);

                                    setSelected(stock.key);
                                    setTargetIds(next);
                                } : undefined,
                            } : undefined}
                            before={board.game.prices.find((price) => price.stockKey === stock.key)?.value ?? 0}
                            after={preview.game.prices.find((price) => price.stockKey === stock.key)?.value ?? 0}
                            selected={selected === stock.key}
                            disabled={busy || board.game.suspended.includes(stock.key)
                              || (targetedSuspensions && !holdersFor(stock.key)
                                  .some((player) => !suspendedFor(stock.key, player._id)))}
                            unavailable={board.game.suspended.includes(stock.key)}
                            onSelect={own ? () =>
                            {
                                setSelected(stock.key);
                                setTargetIds([]);
                            } : undefined}
                        />
                    ))}
                </div>
            )}
            {error && <p className="alert alert-danger" role="alert">{error}</p>}
            {(own || spectator) && (
                <div className={`suspension-actions ${own ? "trade-footer" : ""}`}>
                    <button className="btn btn-secondary" disabled={busy} onClick={() => setConfirmSkip(true)}>Skip</button>
                    {own && (
                        <button
                            className="btn btn-primary"
                            disabled={busy || selected === undefined || board.game.suspended.includes(selected)
                              || (targetedSuspensions && checkedIds.length === 0)}
                            onClick={() =>
                            {
                                void onDecision?.(selected, targetedSuspensions ? checkedIds : undefined);
                            }}
                        >
                            Suspend
                        </button>
                    )}
                </div>
            )}
            {confirmSkip && (
                <SuspensionSkipConfirmation
                    busy={busy}
                    error={error}
                    onCancel={() => setConfirmSkip(false)}
                    onConfirm={() =>
                    {
                        void onDecision?.().then((success) =>
                        {
                            if (success)
                            {
                                setConfirmSkip(false);
                            }
                        });
                    }}
                />
            )}
        </section>
    );
}
