import { floorTradeQuantity } from "../shared/rules";

export function sharesForCash(cash: number, price: number)
{
    if (!Number.isFinite(cash) || !Number.isFinite(price) || cash <= 0 || price <= 0)
    {
        return 0;
    }

    // Small tolerance avoids losing a lot to floating-point currency rounding.
    return floorTradeQuantity((cash + 0.000_001) / price);
}

export function stepShares(quantity: number, direction: 1 | -1)
{
    const current = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
    if (direction === 1)
    {
        return current < 5000 ? (Math.floor(current / 1000) + 1) * 1000
            : (Math.floor(current / 10_000) + 1) * 10_000;
    }

    return current <= 5000 ? Math.max(0, (Math.ceil(current / 1000) - 1) * 1000)
        : Math.max(5000, (Math.ceil(current / 10_000) - 1) * 10_000);
}

export interface TradeDraft { field: "shares" | "cash"; value: string }

export function resolveTradeDraft(draft: TradeDraft, price: number, limit: number)
{
    const entered = Number(draft.value);
    const quantity = draft.field === "cash"
        ? Math.min(limit, sharesForCash(entered, price)) : entered;
    const cost = Number.isFinite(quantity * price) ? Number((quantity * price).toFixed(2)) : 0;

    return {
        quantity,
        shares: draft.field === "shares" ? draft.value : String(quantity),
        cash: draft.field === "cash" ? draft.value : String(cost),
    };
}
