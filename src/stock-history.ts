import { priceSeries } from "./price-history";
import type { Board } from "./types";

export function stockHistory(game: Board["game"], stockKey: number)
{
    const history = priceSeries(game, stockKey).filter((point) => point.value !== null);
    const values = history.map((point) => point.value ?? 0);
    const start = values[0] ?? 0;
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;
    const points = history.map((point) =>
    {
        const x = 4 + point.round / (game.periodCount + 1) * 172;
        const y = max === min ? 30 : 56 - ((point.value ?? 0) - min) / (max - min) * 52;

        return `${x},${y}`;
    }).join(" ");

    return { start, min, max, points };
}
