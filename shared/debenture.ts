interface Price { stockKey: number; value: number }
interface Snapshot { period: number; prices: Price[] }
export interface PurchaseEvent {
    kind: string;
    stockKey?: number;
    quantity?: number;
    unitPrice?: number;
}

/** Ordinary sales consume the oldest purchases first; claims refund only shares still held. */
export function purchaseCost(stockKey: number, quantity: number, events: PurchaseEvent[]): number | null
{
    const lots: { quantity: number; price: number | undefined }[] = [];
    for (const event of events)
    {
        if (event.stockKey !== stockKey)
        {
            continue;
        }

        switch (event.kind)
        {
            case "buy": {
                lots.push({ quantity: event.quantity ?? 0, price: event.unitPrice });

                break;
            }
            case "debenture": {
                lots.length = 0;

                break;
            }
            case "sell": {
                let remaining = event.quantity ?? 0;

                while (remaining > 0 && lots.length > 0)
                {
                    const sold = Math.min(remaining, lots[0].quantity);

                    lots[0].quantity -= sold;
                    remaining -= sold;

                    if (lots[0].quantity === 0)
                    {
                        lots.shift();
                    }
                }

                break;
            }
        // No default
        }
    }

    if (quantity <= 0 || lots.reduce((sum, lot) => sum + lot.quantity, 0) !== quantity
      || lots.some((lot) => lot.price === undefined || !Number.isFinite(lot.price) || lot.price <= 0))
    {
        return null;
    }

    return Math.round(lots.reduce((sum, lot) => sum + lot.quantity * lot.price!, 0) * 100) / 100;
}

/** The two claim rounds are the first two trading periods after the price reaches zero. */
export function bankruptcyPeriod(stockKey: number, history: Snapshot[], currentPeriod: number): number | null
{
    let solvent = false;
    let bankrupt: number | null = null;
    const snapshots = history.filter((item) => item.period <= currentPeriod).toSorted((a, b) => a.period - b.period);
    for (const snapshot of snapshots)
    {
        const price = snapshot.prices.find((item) => item.stockKey === stockKey)?.value;
        if (price !== undefined && price > 0)
        {
            solvent = true;
            bankrupt = null;
        }
        else if (price !== undefined && price <= 0 && solvent && bankrupt === null)
        {
            bankrupt = snapshot.period;
        }
    }

    return bankrupt;
}
