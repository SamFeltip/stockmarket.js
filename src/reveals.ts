import { cashStock, cashStockKey } from "../shared/chance-cards";
import type { Stock as DisplayStock } from "./display-types";
import type { Insight, Stock } from "./types";

export function revealStocks<T extends Pick<Stock, "key" | "display">>(
    stocks: T[], insights: Pick<Insight, "stockKey">[])
{
    return [
        ...stocks.filter((stock) => stock.display),
        ...stocks.filter((stock) => !stock.display && insights.some((item) => item.stockKey === stock.key)),
    ];
}

/** Cash is always the last reveal, including rounds with no cash cards. */
export function revealGroups(stocks: DisplayStock[], insights: Pick<Insight, "stockKey">[])
{
    if (stocks.length === 0 && insights.length === 0)
    {
        return [];
    }

    return [...revealStocks(stocks, insights).filter((stock) => stock.key !== cashStockKey), cashStock];
}
