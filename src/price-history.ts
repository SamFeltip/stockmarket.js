import type { Board } from "./types";

export function priceSeries(game: Pick<Board["game"], "priceHistory" | "currentPeriod" | "prices" | "periodCount">,
    stockKey: number)
{
    const history = game.priceHistory ?? [{ period: game.currentPeriod, prices: game.prices }];

    return Array.from({ length: game.periodCount + 2 }, (_, round) => ({
        round,
        value: history.find((snapshot) => snapshot.period === round)?.prices
            .find((price) => price.stockKey === stockKey)?.value ?? null,
    }));
}
