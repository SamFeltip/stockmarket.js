import type { Insight, Stock } from "./types";

export function revealStocks<T extends Pick<Stock, "key" | "display">>(
    stocks: T[], insights: Pick<Insight, "stockKey">[])
{
    return [
        ...stocks.filter((stock) => stock.display),
        ...stocks.filter((stock) => !stock.display && insights.some((item) => item.stockKey === stock.key)),
    ];
}
