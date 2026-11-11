import type { Board } from "./display-types";

export interface ChartTrade {
    stockKey: number;
    period: number;
    bargainRound?: number;
    title: string;
    imageRoot: string;
    quantity: number;
}

export interface ChartPoint {
    round: number;
    value: number | null;
    trades?: ChartTrade[];
}

export function priceSeries(game: Pick<Board["game"], "priceHistory" | "currentPeriod" | "prices" | "periodCount">,
    stockKey: number, tradesByPeriod: ReadonlyMap<number, ChartTrade[]> = new Map()): ChartPoint[]
{
    const history = game.priceHistory ?? [{ period: game.currentPeriod, prices: game.prices }];

    return Array.from({ length: game.periodCount + 2 }, (_, round) =>
    {
        const snapshot = history.find((item) => item.period === round);
        const steps = snapshot?.steps?.find((item) => item.stockKey === stockKey);
        const period = round - 1;
        const trades = tradesByPeriod.get(period);
        const opening = trades && history.find((item) => item.period === period)?.prices
            .find((price) => price.stockKey === stockKey)?.value;
        const hasTrades = trades && opening !== undefined;
        const tradeColumns = hasTrades ? 1 : 0;
        const count = (steps?.count || 1) + tradeColumns;
        // Each insight gets one slot. A period with trades uses one extra slot for the whole stack.
        const points: ChartPoint[] = hasTrades ? [{ round: period + 1 / count, value: opening, trades }] : [];
        if (steps && steps.count > 0)
        {
            points.push(...steps.values.map((value, index) => ({
                round: period + (tradeColumns + index + 1) / count, value,
            })));
        }
        else
        {
            points.push({ round, value: snapshot?.prices.find((price) => price.stockKey === stockKey)?.value ?? null });
        }

        return points;
    }).flat();
}

export function chartSeries(game: Board["game"], stockKey: number, trades: ChartTrade[]): ChartPoint[]
{
    const completedPeriods = game.currentPeriod + Number(game.status === "finished");
    const tradesByPeriod = new Map<number, ChartTrade[]>();
    for (const trade of trades)
    {
        if (trade.stockKey !== stockKey || trade.period < 0 || trade.period >= completedPeriods)
        {
            continue;
        }

        const group = tradesByPeriod.get(trade.period) ?? [];

        group.push(trade);
        tradesByPeriod.set(trade.period, group);
    }

    return priceSeries(game, stockKey, tradesByPeriod);
}
