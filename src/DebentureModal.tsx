import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { hideModal } from "./bootstrap";
import { Alert, Modal, money, useAction } from "./shared";
import type { Board } from "./types";

export type DebentureActivation = (insightId: Board["insights"][number]["_id"], stockKey: number) => Promise<void>;

export function DebentureModal({ board, insightId, used, onActivate }: {
    board: Board; insightId: Board["insights"][number]["_id"]; used: boolean; onActivate?: DebentureActivation;
})
{
    const redeem = useMutation(api.trading.redeemDebenture);
    const { run, busy, error } = useAction();
    const [stockKey, setStockKey] = useState<number>();
    const offers = (board.debentureOffers ?? []).flatMap((offer) =>
    {
        const stock = board.stocks.find((item) => item.key === offer.stockKey);

        return stock ? [{ ...offer, stock }] : [];
    });
    const selected = offers.find((offer) => offer.stockKey === stockKey && !offer.unavailableReason);
    const myTurn = board.game.status === "playing" && board.game.currentPlayerId === board.player._id;
    const id = `chance-card-${insightId}`;

    function closeDialog()
    {
        const dialog = document.querySelector<HTMLElement>(`#${id}`);
        if (dialog)
        {
            hideModal(dialog);
        }

        setStockKey(undefined);
    }

    return (
        <Modal id={id} title="Debenture" mobileDrawer>
            <div className="modal-body loan-detail d-grid gap-3">
                <h2 className="text-black mb-0">Debenture</h2>
                <p>
                    Keep this card between rounds. If a company you own goes bankrupt,
                    you have two rounds to claim back what you paid.
                </p>
                <p>Choose one company to sell all your stocks in it. Selling uses one turn and spends this card.</p>
                {offers.length > 0 ? (
                    <div className="debenture-stock-list" role="radiogroup" aria-label="Bankrupt stocks you own">
                        {offers.map((offer) => (
                            <label key={offer.stockKey} className={`debenture-stock ${stockKey === offer.stockKey ? "is-selected" : ""}`}>
                                <input
                                    className="visually-hidden"
                                    type="radio"
                                    name={`${id}-stock`}
                                    aria-label={`${offer.stock.name}: ${money(offer.quantity)} stocks`}
                                    checked={stockKey === offer.stockKey}
                                    disabled={busy || Boolean(offer.unavailableReason)}
                                    onChange={() => setStockKey(offer.stockKey)}
                                />
                                <span className="debenture-stock-picture">
                                    <img src={offer.stock.imagePath} alt={offer.stock.name} />
                                    {stockKey === offer.stockKey && (
                                        <span className="debenture-stock-check" aria-hidden="true">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 4 4 10-10" /></svg>
                                        </span>
                                    )}
                                </span>
                                <span>{`${money(offer.quantity)} stocks`}</span>
                                {offer.unitPrice !== null && (
                                    <span className="debenture-stock-price">
                                        {`${Math.abs(offer.unitPrice * 100 - Math.round(offer.unitPrice * 100)) > 0.000_001 ? "≈" : ""}£${offer.unitPrice.toFixed(2)} each`}
                                    </span>
                                )}
                                {offer.unavailableReason && <span className="debenture-unavailable">{offer.unavailableReason}</span>}
                            </label>
                        ))}
                    </div>
                ) : <p className="debenture-empty">You don’t own any bankrupt stocks right now. Keep this card for a later round.</p>}
                {offers.some((offer) => !offer.unavailableReason) && (
                    <h3 className="mb-0" aria-live="polite">
                        {selected ? `Sell for £${money(selected.amount ?? 0)}` : "Choose a stock to see its payout"}
                    </h3>
                )}
                {!myTurn && <p>Wait for your turn to sell.</p>}
                <Alert message={error} />
            </div>
            <div className="modal-footer trade-footer">
                <button type="button" className="btn btn-secondary" onClick={closeDialog} disabled={busy}>Cancel</button>
                <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!selected || !myTurn || used || busy}
                    onClick={() =>
                    {
                        if (!selected || !myTurn || used || busy)
                        {
                            return;
                        }

                        void run(async () =>
                        {
                            await (onActivate ? onActivate(insightId, selected.stockKey) : redeem({
                                code: board.game.code,
                                expectedTurn: board.game.turn, expectedPeriod: board.game.currentPeriod,
                                insightId, stockKey: selected.stockKey }));
                            closeDialog();
                        });
                    }}
                >
                    {busy ? "Selling…" : "Sell"}
                </button>
            </div>
        </Modal>
    );
}
