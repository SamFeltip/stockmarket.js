import { floorTradeQuantity, sharesPerCompany } from "../shared/rules";
import { TradeInputs } from "./TradeInputs";
import { TradePosition } from "./TradePosition";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Modal, money, useAction } from "./shared";
import { StockPreview } from "./StockPreview";
import { modalInstance } from "./bootstrap";
import { resolveTradeDraft, sharesForCash, stepShares, tradeUnavailableReason } from "./trades";
import type { TradeDraft } from "./trades";
import type { Board, Stock } from "./types";

export function TradeModal({ board, stock, mode }: { board: Board; stock: Stock; mode: "buy" | "sell" })
{
    const play = useMutation(api.trading.play);
    const { run, busy, error } = useAction();
    const [draft, setDraft] = useState<TradeDraft>({ field: "shares", value: "0" });

    function setQuantity(value: number)
    {
        setDraft({ field: "shares", value: String(value) });
    }

    const price = board.game.prices.find((item) => item.stockKey === stock.key)?.value ?? 0;
    const held = board.player.holdings.find((item) => item.stockKey === stock.key)?.quantity ?? 0;
    const available = sharesPerCompany - board.players.reduce((sum, player) => sum
      + (player.holdings.find((item) => item.stockKey === stock.key)?.quantity ?? 0), 0);
    const limit = floorTradeQuantity(mode === "buy"
        ? Math.min(available, sharesForCash(board.player.cash, price)) : held);
    const { quantity, shares, cash } = resolveTradeDraft(draft, price, limit);
    const previewQuantity = Number.isFinite(quantity) ? quantity : 0;
    const projectedHolding = held + (mode === "buy" ? previewQuantity : -previewQuantity);
    const reason = tradeUnavailableReason({ mode, price, quantity, available, held, cash: board.player.cash,
        isTurn: board.game.currentPlayerId === board.player._id,
        isPlaying: board.game.status === "playing", tradable: stock.display });
    const valid = !reason;
    const label = mode === "buy" ? "Buy" : "Sell";

    return (
        <Modal id={`${mode}Modal`} title={`${label} ${stock.name}`} mobileDrawer>
            <div className="modal-body d-flex flex-column gap-2">
                <div className="trade-preview"><StockPreview board={board} stock={stock} large /></div>
                <p className="small">{`Maximum: ${money(limit)} shares`}</p>
                <form
                    id={`${mode}Stock`}
                    noValidate
                    onSubmit={(event) =>
                    {
                        event.preventDefault();

                        if (!valid || busy)
                        {
                            return;
                        }

                        void run(async () =>
                        {
                            await play({ code: board.game.code, expectedTurn: board.game.turn,
                                expectedPeriod: board.game.currentPeriod, stockKey: stock.key,
                                quantity: mode === "buy" ? quantity : -quantity });
                            const dialog = document.querySelector<HTMLElement>(`#${mode}Modal`);
                            if (dialog)
                            {
                                modalInstance(dialog)?.hide();
                            }

                            setQuantity(0);
                        });
                    }}
                >
                    <TradeInputs
                        shares={shares}
                        cash={cash}
                        quantity={quantity}
                        limit={limit}
                        busy={busy}
                        valid={valid}
                        feedbackId={`${mode}-trade-feedback`}
                        setDraft={setDraft}
                        setQuantity={setQuantity}
                        resolve={(value) => resolveTradeDraft(value, price, limit).quantity}
                        increase={(value) => stepShares(value, 1)}
                        decrease={(value) => stepShares(value, -1)}
                    >
                        <TradePosition
                            cash={board.player.cash + (mode === "buy" ? -1 : 1) * previewQuantity * price}
                            holding={projectedHolding}
                            buying={mode === "buy"}
                            assignedRoles={board.players.flatMap((player) => player.roles
                                .filter((role) => role.stockKey === stock.key).map((role) => role.role))}
                        />
                    </TradeInputs>
                </form>
            </div>
            <div className="modal-footer trade-footer d-flex flex-row">
                <p id={`${mode}-trade-feedback`} className="trade-feedback" role="status" aria-live="polite" aria-atomic="true">
                    {error || reason}
                </p>
                <button type="button" className="btn btn-secondary flex-fill" data-bs-dismiss="modal">Cancel</button>
                <button
                    className={`btn btn-${mode === "buy" ? "success" : "danger"} flex-fill`}
                    type="submit"
                    form={`${mode}Stock`}
                    disabled={busy || !valid}
                >
                    {label}
                </button>
            </div>
        </Modal>
    );
}
