import type { Board } from "./types";

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
