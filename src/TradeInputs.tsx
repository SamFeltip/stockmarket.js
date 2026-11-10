import "./trade-inputs.css";
import type { ReactNode } from "react";
import type { TradeDraft } from "./trades";

export function TradeInputs({ shares, cash, quantity, limit, busy, valid, feedbackId, setDraft, setQuantity,
    resolve, increase, decrease, step = 1000, children }: {
    shares: string; cash: string; quantity: number; limit: number; busy: boolean; valid: boolean; feedbackId: string;
    setDraft: (value: TradeDraft | ((current: TradeDraft) => TradeDraft)) => void;
    setQuantity: (value: number) => void; resolve: (draft: TradeDraft) => number;
    increase: (quantity: number) => number; decrease: (quantity: number) => number; step?: number; children: ReactNode;
})
{
    return (
        <div className="purchase-form trade-inputs flex-fill">
            <h6 className="mb-0 header-amount-of-stocks">Amount of stocks</h6>
            <h6 className="mb-0 header-value">Value</h6>
            <div className="input-stock-group input-group mb-0">
                <input
                    aria-label="Amount of stocks"
                    aria-describedby={feedbackId}
                    aria-invalid={quantity !== 0 && !valid}
                    type="number"
                    step={step}
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
                    aria-describedby={feedbackId}
                    onChange={(event) =>
                    {
                        setDraft({ field: "cash", value: event.target.value });
                    }}
                    onBlur={() =>
                    {
                        setDraft((current) => ({ field: "shares",
                            value: String(resolve(current)) }));
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
                        setQuantity(decrease(quantity));
                    }}
                >
                    -
                </button>
                <button
                    type="button"
                    className="btn btn-secondary flex-fill"
                    disabled={busy || limit <= 0}
                    onClick={() => setQuantity(limit)}
                >
                    Max out
                </button>
                <button
                    type="button"
                    className="btn btn-success flex-fill"
                    aria-label="Increase amount"
                    disabled={busy}
                    onClick={() =>
                    {
                        setQuantity(increase(quantity));
                    }}
                >
                    +
                </button>
            </div>
            {children}
        </div>
    );
}
