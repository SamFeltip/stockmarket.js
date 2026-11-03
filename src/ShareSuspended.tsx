import { DecisionPortfolios } from "./DecisionPortfolios";
import { SelectionTick } from "./SelectionTick";
import { useEffect, useRef, useState } from "react";
import { previewRound } from "./round-preview";
import type { Board, Insight, Stock, Player } from "./display-types";
import "./share-suspended.css";

const count = (value: number) => value.toLocaleString("en-GB");
const quantityHeld = (player: Player | undefined, stockKey: number) =>
    player?.holdings.find((holding) => holding.stockKey === stockKey)?.quantity ?? 0;

export function SuspensionStock({ stock, quantity, before, after, selected = false, disabled = false,
    unavailable = false, spectator = false, onSelect }: {
    stock: Stock; quantity: number; spectator?: boolean;
    before: number; after: number; selected?: boolean; disabled?: boolean; unavailable?: boolean; onSelect?: () => void;
})
{
    const change = Math.round((after - before) * 100) / 100;
    const tone = change < 0 ? "danger" : (change > 0 ? "success" : "secondary");
    const content = (
        <>
            <img src={stock.imagePath} alt="" />
            <strong>{stock.name}</strong>
            {!spectator && <span className="suspension-quantity">{`${count(quantity)} shares`}</span>}
            {spectator && (
                <div className="suspension-spectator-price">
                    <span>worth</span>
                    <strong>{`£${before.toFixed(2)}`}</strong>
                </div>
            )}
            <div
                className={`suspension-change total-insight text-${tone}`}
                aria-label={`Price change: ${change >= 0 ? "+" : "−"}£${Math.abs(change).toFixed(2)}`}
            >
                {change !== 0 && <img src={`/static/imgs/icons/stock_${change > 0 ? "up" : "down"}.svg`} alt="" />}
                <span>{`${change === 0 ? "+" : ""}£${Math.abs(change).toFixed(2)}`}</span>
            </div>
            {spectator ? (
                <div className="suspension-spectator-price">
                    <span>new valuation</span>
                    <strong>{`£${after.toFixed(2)}`}</strong>
                </div>
            ) : (
                <div className="suspension-valuations">
                    <div>
                        <span>worth</span>
                        <strong>{`£${before.toFixed(2)}`}</strong>
                    </div>
                    <div>
                        <span>new valuation</span>
                        <strong>{`£${after.toFixed(2)}`}</strong>
                    </div>
                </div>
            )}
        </>
    );

    return onSelect ? (
        <label className={`suspension-stock ${selected ? "is-selected" : ""} ${disabled ? "is-unavailable" : ""}`}>
            <input
                className="visually-hidden"
                type="radio"
                name="suspended-stock"
                aria-label={stock.name}
                checked={selected}
                disabled={disabled}
                onChange={onSelect}
            />
            <span className="suspension-check" aria-hidden="true">{selected && <SelectionTick />}</span>
            {content}
            {unavailable && <small>Already suspended</small>}
        </label>
    ) : <article className="suspension-stock">{content}</article>;
}

function SkipConfirmation({ busy, error, onCancel, onConfirm }: {
    busy: boolean; error: string; onCancel: () => void; onConfirm: () => void;
})
{
    const dialog = useRef<HTMLDialogElement>(null);

    useEffect(() =>
    {
        dialog.current?.showModal();
    }, []);

    return (
        <dialog
            ref={dialog}
            className="suspension-confirm"
            aria-labelledby="suspension-skip-title"
            onCancel={(event) =>
            {
                event.preventDefault();

                if (!busy)
                {
                    onCancel();
                }
            }}
        >
            <h2 id="suspension-skip-title">Skip Share Suspended?</h2>
            <p>This card will be spent and won’t carry over to the next bargaining period.</p>
            {error && <p className="alert alert-danger" role="alert">{error}</p>}
            <div className="trade-footer">
                <button className="btn btn-secondary" disabled={busy} onClick={onCancel}>Cancel</button>
                <button className="btn btn-primary" disabled={busy} onClick={onConfirm}>Confirm skip</button>
            </div>
        </dialog>
    );
}

export function ShareSuspended({ board, card, own = false, spectator = false, busy = false, error = "", onDecision }: {
    board: Board; card: Insight; own?: boolean; spectator?: boolean; busy?: boolean; error?: string;
    onDecision?: (stockKey?: number) => Promise<boolean>;
})
{
    const [selected, setSelected] = useState<number>();
    const [confirmSkip, setConfirmSkip] = useState(false);
    const owner = board.players.find((player) => player._id === card.playerId);
    const stocks = board.stocks.filter((stock) => stock.display)
        .toSorted((a, b) => (a.variation ?? 0) - (b.variation ?? 0));
    const preview = previewRound(board, board.insights, stocks.map((stock) => stock.key));

    return (
        <section className={`suspension-panel ${spectator ? "suspension-spectator" : ""}`} aria-label="Share Suspended decision">
            <div className="suspension-summary">
                <header className="suspension-heading">
                    <p>Chance Card</p>
                    <h1>Share Suspended</h1>
                    {own && <p>Choose a stock price to suspend. Its new valuation will be removed.</p>}
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
            {(own || spectator) && (
                <div className="suspension-stocks" role={own ? "radiogroup" : "group"} aria-label="Stock valuations, ordered by volatility">
                    {stocks.map((stock) => (
                        <SuspensionStock
                            key={stock.key}
                            stock={stock}
                            spectator={spectator}
                            quantity={quantityHeld(owner, stock.key)}
                            before={board.game.prices.find((price) => price.stockKey === stock.key)?.value ?? 0}
                            after={preview.game.prices.find((price) => price.stockKey === stock.key)?.value ?? 0}
                            selected={selected === stock.key}
                            disabled={busy || board.game.suspended.includes(stock.key)}
                            unavailable={board.game.suspended.includes(stock.key)}
                            onSelect={own ? () => setSelected(stock.key) : undefined}
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
                            disabled={busy || selected === undefined || board.game.suspended.includes(selected)}
                            onClick={() =>
                            {
                                void onDecision?.(selected);
                            }}
                        >
                            Suspend
                        </button>
                    )}
                </div>
            )}
            {confirmSkip && (
                <SkipConfirmation
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
