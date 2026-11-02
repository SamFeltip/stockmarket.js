import { cashStockKey } from "./chance-cards";

interface Price { stockKey: number; value: number }
interface Insight { stockKey: number; playerId: string; value: number }
interface Stock { key: number; display: boolean; name: string }

export function settledPrice(opening: number, change: number): number
{
    return Math.max(0, Math.round((opening + change) * 100) / 100);
}

export function roundPrices(prices: Price[], insights: Insight[], stocks: Stock[], suspended: number[])
{
    return prices.map((price) =>
    {
        const stock = stocks.find((item) => item.key === price.stockKey);
        const change = stock?.display && !suspended.includes(price.stockKey)
            ? insights.filter((insight) => insight.stockKey === price.stockKey)
                .reduce((sum, insight) => sum + insight.value, 0) : 0;

        return { ...price, value: settledPrice(price.value, change) };
    });
}

export function roundCash(player: { _id: string; cash: number }, insights: Insight[], stocks: Stock[])
{
    const change = insights.filter((insight) => insight.playerId === player._id
      && stocks.some((stock) => stock.key === insight.stockKey && stock.name === "currency"))
        .reduce((sum, insight) => sum + insight.value, 0);

    // New board-game cash cards affect everyone, just like company-price cards.
    // Round the adjustment, not the player's existing balance, to the nearest £1,000.
    const cashPercent = Math.round(insights.filter((insight) => insight.stockKey === cashStockKey)
        .reduce((sum, insight) => sum + insight.value, 0) * 100);
    const adjustment = Math.sign(cashPercent) * Math.round(player.cash * Math.abs(cashPercent) / 100 / 1000) * 1000;

    // Preserve the old per-player semantics for explicitly imported legacy currency cards.
    return Math.max(0, Math.trunc(player.cash * (1 + change)) + adjustment);
}

export function portfolioWorth(player: { cash: number; holdings: { stockKey: number; quantity: number }[] },
    prices: Price[])
{
    return player.cash + player.holdings.reduce((total, holding) => total + holding.quantity
      * (prices.find((price) => price.stockKey === holding.stockKey)?.value ?? 0), 0);
}
