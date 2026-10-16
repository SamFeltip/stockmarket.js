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
