import { gamePeriodNumber, legacyTechRounds, techMarketSteps } from "../shared/packs";
import type { Board } from "./display-types";

const axisDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTickSpacing = 100;
const techTradeWidth = 0.2;

export function chartDateAxis(game: Pick<Board["game"], "pack" | "tradingDates">, periods: number, plotWidth: number)
{
    const dates = game.tradingDates?.boundaries;
    if (game.pack !== "tech" || !dates?.[periods] || plotWidth < 3 * dateTickSpacing)
    {
        return undefined;
    }

    const intervals = Math.min(periods, Math.floor(plotWidth / dateTickSpacing));
    const ticks = Array.from({ length: intervals + 1 }, (_, index) => Math.round(index * periods / intervals));

    return { ticks, format: (period: number) => axisDate.format(new Date(dates[period])) };
}

export function chartRoundCount(game: Pick<Board["game"], "pack" | "currentPeriod" | "periodCount">)
{
    const total = game.periodCount + 1;

    return legacyTechRounds(game)
        ? Math.min(total, gamePeriodNumber(game, game.currentPeriod) * techMarketSteps) : total;
}

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
    date?: string;
}

type PriceHistoryGame = Pick<Board["game"], "priceHistory" | "currentPeriod" | "prices" | "periodCount">
  & Partial<Pick<Board["game"], "pack" | "tradingDates">>;

export function priceSeries(game: PriceHistoryGame,
    stockKey: number, tradesByPeriod: ReadonlyMap<number, ChartTrade[][]> = new Map(),
    lastRound = game.periodCount + 1): ChartPoint[]
{
    const history = game.priceHistory ?? [{ period: game.currentPeriod, prices: game.prices }];

    return Array.from({ length: lastRound + 1 }, (_, round) =>
    {
        const snapshot = history.find((item) => item.period === round);
        const steps = snapshot?.steps?.find((item) => item.stockKey === stockKey);
        const period = round - 1;
        const groups = tradesByPeriod.get(period) ?? [];
        const openingDate = game.tradingDates?.boundaries?.[period];
        const closingDate = game.tradingDates?.boundaries?.[round];
        const dailyDates = game.tradingDates?.dailyCloses?.[period];
        const opening = groups.length > 0 ? history.find((item) => item.period === period)?.prices
            .find((price) => price.stockKey === stockKey)?.value : undefined;
        const tradeColumns = opening === undefined ? 0 : groups.length;
        const count = (steps?.count || 1) + tradeColumns;
        const techTrades = game.pack === "tech" && tradeColumns > 0;
        // Tech trades all use the opening quote. Keep their marker clear of the daily closes.
        const points: ChartPoint[] = opening === undefined ? [] : groups.map((trades, index) => ({
            round: period + (techTrades ? techTradeWidth / 2 : (index + 1) / count), value: opening, trades,
            ...(openingDate && { date: openingDate }),
        }));
        if (steps && steps.count > 0)
        {
            points.push(...steps.values.map((value, index) =>
            {
                const date = dailyDates?.length === steps.count ? dailyDates[index]
                    : (index + 1 === steps.count ? closingDate : undefined);

                const position = techTrades ? techTradeWidth + (1 - techTradeWidth) * (index + 1) / steps.count
                    : (tradeColumns + index + 1) / count;

                return { round: period + position, value, ...(date && { date }) };
            }));
        }
        else
        {
            points.push({ round, value: snapshot?.prices.find((price) => price.stockKey === stockKey)?.value ?? null,
                ...(closingDate && { date: closingDate }) });
        }

        return points;
    }).flat();
}

export function chartSeries(game: Board["game"], stockKey: number, trades: ChartTrade[]): ChartPoint[]
{
    const tradesByPeriod = new Map<number, ChartTrade[][]>();
    for (const trade of trades)
    {
        if (trade.stockKey !== stockKey || trade.period < 0 || trade.period > game.currentPeriod)
        {
            continue;
        }

        const groups = tradesByPeriod.get(trade.period) ?? [];
        const round = game.pack === "tech" ? groups[0]
            : groups.find((group) => group[0].bargainRound === trade.bargainRound);
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

    return priceSeries(game, stockKey, tradesByPeriod, chartRoundCount(game));
}
