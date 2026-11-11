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
    stockKey: number, tradesByPeriod: ReadonlyMap<number, ChartTrade[][]> = new Map()): ChartPoint[]
{
    const history = game.priceHistory ?? [{ period: game.currentPeriod, prices: game.prices }];

    return Array.from({ length: game.periodCount + 2 }, (_, round) =>
    {
        const snapshot = history.find((item) => item.period === round);
        const steps = snapshot?.steps?.find((item) => item.stockKey === stockKey);
        const period = round - 1;
        const groups = tradesByPeriod.get(period) ?? [];
        const opening = groups.length > 0 ? history.find((item) => item.period === period)?.prices
            .find((price) => price.stockKey === stockKey)?.value : undefined;
        const tradeColumns = opening === undefined ? 0 : groups.length;
        const count = (steps?.count || 1) + tradeColumns;
        // Every occupied trade round and every insight gets one slot.
        const points: ChartPoint[] = opening === undefined ? [] : groups.map((trades, index) => ({
            round: period + (index + 1) / count, value: opening, trades,
        }));
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
    const tradesByPeriod = new Map<number, ChartTrade[][]>();
    for (const trade of trades)
    {
        if (trade.stockKey !== stockKey || trade.period < 0 || trade.period >= completedPeriods)
        {
            continue;
        }

        const groups = tradesByPeriod.get(trade.period) ?? [];
        const round = groups.find((group) => group[0].bargainRound === trade.bargainRound);
        if (round)
        {
            round.push(trade);
        }
        else
        {
            groups.push([trade]);
        }

        tradesByPeriod.set(trade.period, groups);
    }

    return priceSeries(game, stockKey, tradesByPeriod);
}
