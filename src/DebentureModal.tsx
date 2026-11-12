import { StockChoice } from "./StockChoice";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { legacyTechRounds } from "../shared/packs";
import { hideModal } from "./bootstrap";
import { Alert, Modal, money, useAction } from "./shared";
import type { Board } from "./types";
import { inStockOrder } from "../shared/rules";
import { bankruptcyBuyoutCard } from "../shared/chance-cards";
import { debentureRuleFor } from "../shared/debenture";

export const debenturePresentation = {
    "fixed-bankruptcy": {
        effect: bankruptcyBuyoutCard.effect,
        description: bankruptcyBuyoutCard.description,
        stockLabel: "Bankrupt stocks you own",
        emptyLabel: "no bankrupt stocks to sell",
    },
    bankruptcy: {
        effect: "Bankruptcy protection",
        description: "Choose one bankrupt company and sell all your stocks at the opening price from the start of the game.",
        stockLabel: "Bankrupt stocks you own",
        emptyLabel: "no bankrupt stocks to sell",
    },
    "price-drop": {
        effect: "Protection against a price drop",
        description: "If a stock you already held drops by 10% or more between settlements, sell at its price before the drop.",
        stockLabel: "Eligible stocks you own",
        emptyLabel: "No eligible stocks to sell",
    },
};

export type DebentureActivation = (insightId: Board["insights"][number]["_id"], stockKey: number) => Promise<void>;

export function DebentureModal({ board, insightId, used, onActivate }: {
    board: Board; insightId: Board["insights"][number]["_id"]; used: boolean; onActivate?: DebentureActivation;
})
{
    const redeem = useMutation(api.trading.redeemDebenture);
    const { run, busy, error } = useAction();
    const [stockKey, setStockKey] = useState<number>();
    const card = board.insights.find((insight) => insight._id === insightId);
    const rule = debentureRuleFor(card ?? {}, board.game.pack);
    const offers = inStockOrder(board.debentureOffers[rule] ?? [], board.stocks).flatMap((offer) =>
    {
        const stock = board.stocks.find((item) => item.key === offer.stockKey);

        return stock ? [{ ...offer, stock }] : [];
    });
    const debenture = debenturePresentation[rule];
    const selected = offers.find((offer) => offer.stockKey === stockKey && !offer.unavailableReason);
    const myTurn = board.game.status === "playing" && board.game.currentPlayerId === board.player._id;
    const title = rule === "fixed-bankruptcy" ? bankruptcyBuyoutCard.name : "Debenture";
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
        <Modal id={id} title={title} mobileDrawer>
            <div className="modal-body loan-detail debenture-detail d-grid gap-3">
                <h2 className="text-black mb-0">{title}</h2>
                <p>{debenture.description}</p>
                <p>{`Single use. Stays in your hand for 2 trading ${legacyTechRounds(board.game) ? "rounds" : "periods"}.`}</p>
                <div className="debenture-stock-list" role="radiogroup" aria-label={debenture.stockLabel}>
                    {offers.length > 0 ? offers.map((offer) => (
                        <DebentureStockChoice
                            key={offer.stockKey}
                            offer={offer}
                            selected={stockKey === offer.stockKey}
                            busy={busy}
                            name={`${id}-stock`}
                            onSelect={() => setStockKey(offer.stockKey)}
                        />
                    )) : <div className="debenture-empty">{debenture.emptyLabel}</div>}
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

type DebentureOffer = NonNullable<Board["debentureOffers"]["bankruptcy"]>[number] & { stock: Board["stocks"][number] };

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
