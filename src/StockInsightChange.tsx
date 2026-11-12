import { techMarketStep } from "../shared/packs";
import { Change } from "./shared";
import type { Board, Insight } from "./types";

export function StockInsightChange({ insights, stockKey, game, button }: {
    insights: Pick<Insight, "stockKey" | "value" | "description" | "forecast">[];
    stockKey: number;
    game: Pick<Board["game"], "pack" | "periodCount" | "currentPeriod">;
    button?: boolean;
})
{
    const cards = insights.filter((card) => card.stockKey === stockKey);
    const forecasts = cards.flatMap(({ forecast, value, description }) =>
        forecast ? [{ ...forecast, value, description }] : []);
    if (forecasts.length > 0)
    {
        const step = techMarketStep(game);
        // Prefer a window in progress, then the next upcoming window. Never sum overlapping forecasts.
        const next = forecasts.filter(({ to }) => to > step).toSorted((a, b) =>
            Math.max(a.from, step) - Math.max(b.from, step) || a.to - b.to)[0];

        return next ? <Change value={next.value} button={button} caption={next.description} /> : null;
    }

    return <Change value={cards.reduce((sum, card) => sum + card.value, 0)} button={button} />;
}
