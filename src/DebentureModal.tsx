import { StockChoice } from "./StockChoice";
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
            <div className="modal-body loan-detail debenture-detail d-grid gap-3">
                <h2 className="text-black mb-0">Debenture</h2>
                <p>
                    Choose one bankrupt company and sell all your stocks at the opening price
                    from the start of the game.
                </p>
                <p>Single use. Stays in your hand for 2 trading periods.</p>
                <div className="debenture-stock-list" role="radiogroup" aria-label="Bankrupt stocks you own">
                    {offers.length > 0 ? offers.map((offer) => (
                        <DebentureStockChoice
                            key={offer.stockKey}
                            offer={offer}
                            selected={stockKey === offer.stockKey}
                            busy={busy}
                            name={`${id}-stock`}
                            onSelect={() => setStockKey(offer.stockKey)}
                        />
                    )) : <div className="debenture-empty">no bankrupt stocks to sell</div>}
                </div>
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

type DebentureOffer = NonNullable<Board["debentureOffers"]>[number] & { stock: Board["stocks"][number] };

export function DebentureStockChoice({ offer, selected, busy, name, onSelect }: {
    offer: DebentureOffer; selected: boolean; busy: boolean; name: string; onSelect: () => void;
})
{
    return (
        <StockChoice
            stock={offer.stock}
            quantity={offer.quantity}
            unitPrice={offer.unitPrice}
            unavailableReason={offer.unavailableReason}
            selected={selected}
            disabled={busy}
            name={name}
            onSelect={onSelect}
        />
    );
}
