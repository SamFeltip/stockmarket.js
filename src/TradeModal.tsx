import { floorTradeQuantity, sharesPerCompany } from "../shared/rules";
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
                    <div className="purchase-form flex-fill">
                        <h6 className="mb-0 header-amount-of-stocks">Amount of stocks</h6>
                        <h6 className="mb-0 header-value">Value</h6>
                        <div className="input-stock-group input-group mb-0">
                            <input
                                aria-label="Amount of stocks"
                                aria-describedby={`${mode}-trade-feedback`}
                                aria-invalid={quantity !== 0 && !valid}
                                type="number"
                                step={1000}
                                min={0}
                                max={limit}
                                disabled={busy}
                                className="form-control input-stock"
                                value={shares}
                                onChange={(event) =>
                                {
                                    setDraft({ field: "shares", value: event.target.value });
                                }}
                            />
                        </div>
                        <p className="equals d-flex justify-content-center align-items-center flex-fill">=</p>
                        <div className="input-cash-group input-group mb-0">
                            <span className="input-group-text text-black bg-white pe-1 border-end-0">£</span>
                            <input
                                className="form-control input-cash border-start-0 ps-0"
                                type="number"
                                min={0}
                                step="0.01"
                                disabled={busy}
                                value={cash}
                                aria-label="Value"
                                aria-describedby={`${mode}-trade-feedback`}
                                onChange={(event) =>
                                {
                                    setDraft({ field: "cash", value: event.target.value });
                                }}
                                onBlur={() =>
                                {
                                    setDraft((current) => ({ field: "shares",
                                        value: String(resolveTradeDraft(current, price, limit).quantity) }));
                                }}
                            />
                        </div>
                        <div className="stock-btns d-flex gap-2">
                            <button
                                type="button"
                                className="btn btn-danger flex-fill"
                                aria-label="Decrease amount"
                                disabled={busy}
                                onClick={() =>
                                {
                                    setQuantity(stepShares(quantity, -1));
                                }}
                            >
                                -
                            </button>
                            <button
                                type="button"
                                className="btn btn-success flex-fill"
                                aria-label="Increase amount"
                                disabled={busy}
                                onClick={() =>
                                {
                                    setQuantity(Math.min(limit, stepShares(quantity, 1)));
                                }}
                            >
                                +
                            </button>
                        </div>
                        <div className="cash-btns d-flex gap-2">
                            <button
                                type="button"
                                className="btn btn-danger flex-fill"
                                aria-label="Decrease amount"
                                disabled={busy}
                                onClick={() =>
                                {
                                    setQuantity(stepShares(quantity, -1));
                                }}
                            >
                                -
                            </button>
                            <button
                                type="button"
                                className="btn btn-success flex-fill"
                                aria-label="Increase amount"
                                disabled={busy}
                                onClick={() =>
                                {
                                    setQuantity(Math.min(limit, stepShares(quantity, 1)));
                                }}
                            >
                                +
                            </button>
                        </div>
                        <div className="transaction-body">
                            <p>
                                Cash £
                                {money(board.player.cash + (mode === "buy" ? -1 : 1) * previewQuantity * price)}
                            </p>
                            <p>
                                Shares held
                                {" "}
                                {held + (mode === "buy" ? previewQuantity : -previewQuantity)}
                            </p>
                        </div>
                    </div>
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
