import { floorTradeQuantity, validTradeQuantity } from "../shared/rules";

export function tradeUnavailableReason({ mode, price, quantity, available, held, cash, isTurn, isPlaying, tradable }: {
    mode: "buy" | "sell"; price: number; quantity: number; available: number; held: number; cash: number;
    isTurn: boolean; isPlaying: boolean; tradable: boolean;
})
{
    if (!isPlaying)
    {
        return "Trading is unavailable while the period is closed.";
    }

    if (!isTurn)
    {
        return "Please wait for your turn before trading.";
    }

    if (!tradable || !Number.isFinite(price) || price <= 0)
    {
        return "This stock cannot be traded.";
    }

    if (mode === "sell" && held < 1000)
    {
        return "You don't have any shares available to sell.";
    }

    if (mode === "buy" && available < 1000)
    {
        return "There are no shares available to buy.";
    }

    if (mode === "buy" && sharesForCash(cash, price) < 1000)
    {
        return "You don't have enough cash to buy 1,000 shares.";
    }

    if (quantity === 0)
    {
        return "Choose at least 1,000 shares.";
    }

    if (!validTradeQuantity(quantity) || quantity < 0)
    {
        return "Enter a positive number of shares in steps of 1,000.";
    }

    if (mode === "sell" && quantity > held)
    {
        return "You can't sell more shares than you own.";
    }

    if (mode === "buy" && quantity > available)
    {
        return "There aren't enough shares available. Try fewer shares.";
    }

    if (mode === "buy" && quantity > sharesForCash(cash, price))
    {
        return "You don't have enough cash. Try fewer shares.";
    }

    return "";
}

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
        return (Math.floor(current / 1000) + 1) * 1000;
    }

    return Math.max(0, (Math.ceil(current / 1000) - 1) * 1000);
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
