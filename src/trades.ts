export function sharesForCash(cash: number, price: number)
{
    if (!Number.isFinite(cash) || !Number.isFinite(price) || cash <= 0 || price <= 0)
    {
        return 0;
    }

    // Small tolerance avoids losing a lot to floating-point currency rounding.
    return Math.floor((cash + 0.000_001) / (price * 1000)) * 1000;
}
