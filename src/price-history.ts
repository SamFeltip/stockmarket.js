import type { Board } from "./display-types";

export function priceSeries(game: Pick<Board["game"], "priceHistory" | "currentPeriod" | "prices" | "periodCount">,
    stockKey: number)
{
    const history = game.priceHistory ?? [{ period: game.currentPeriod, prices: game.prices }];

    return Array.from({ length: game.periodCount + 2 }, (_, round) =>
    {
        const snapshot = history.find((item) => item.period === round);
        const steps = snapshot?.steps?.find((item) => item.stockKey === stockKey);
        if (steps && steps.count > 0)
        {
            return steps.values.map((value, index) => ({
                round: round - 1 + (index + 1) / steps.count, value,
            }));
        }

        return [{ round, value: snapshot?.prices.find((price) => price.stockKey === stockKey)?.value ?? null }];
    }).flat();
}

export interface ChartTrade {
    stockKey: number;
    period: number;
    title: string;
    imageRoot: string;
    quantity: number;
}

export interface ChartPoint {
    round: number;
    value: number | null;
    trade?: ChartTrade;
}

export function chartSeries(game: Board["game"], stockKey: number, trades: ChartTrade[]): ChartPoint[]
{
    const prices = priceSeries(game, stockKey);
    const stockTrades = trades.filter((trade) => trade.stockKey === stockKey && trade.period >= 0
      && trade.period <= game.currentPeriod);
    const markers = new Map<number, ChartTrade[]>();
    for (const trade of stockTrades)
    {
        const periodTrades = markers.get(trade.period) ?? [];

        periodTrades.push(trade);
        markers.set(trade.period, periodTrades);
    }

    const points: ChartPoint[] = prices.map((point) =>
    {
        const period = Math.ceil(point.round) - 1;
        if (point.round % 1 === 0 || !markers.has(period))
        {
            return point;
        }

        // Trades happen at the opening price before any insights are revealed.
        return { ...point, round: period + 0.5 + (point.round - period) / 2 };
    });
    const history = game.priceHistory ?? [{ period: game.currentPeriod, prices: game.prices }];
    for (const [period, events] of markers)
    {
        const opening = history.find((snapshot) => snapshot.period === period)?.prices
            .find((price) => price.stockKey === stockKey)?.value;
        if (opening !== undefined)
        {
            points.push(...events.map((trade, index) => ({
                round: period + (index + 1) / (2 * (events.length + 1)), value: opening, trade,
            })));
        }
    }

    return points.toSorted((a, b) => a.round - b.round);
}
