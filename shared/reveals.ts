import { cashStock, cashStockKey, chanceStockKey } from "./chance-cards";

interface RevealStock { key: number; display: boolean }
interface RevealInsight { stockKey: number }

export function revealStocks<T extends RevealStock>(
    stocks: T[], insights: RevealInsight[])
{
    return [
        ...stocks.filter((stock) => stock.display),
        ...stocks.filter((stock) => !stock.display && insights.some((item) => item.stockKey === stock.key)),
    ];
}

/** Cash is always the last reveal, including rounds with no cash cards. */
export function revealGroups<T extends RevealStock>(stocks: T[], insights: RevealInsight[])
{
    if (stocks.length === 0 && insights.length === 0)
    {
        return [];
    }

    return [...revealStocks(stocks, insights)
        .filter((stock) => stock.key !== cashStockKey && stock.key !== chanceStockKey), cashStock];
}
