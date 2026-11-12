import { lastItem } from "../shared/rules";
import { chartRoundCount, chartSeries, type PriceHistoryGame } from "./price-history";
import { tradeMarkerLayout } from "./TradeMarkers";
import type { Board } from "./display-types";

export function stockHistory(game: PriceHistoryGame, stockKey: number, fitToHistory = false, trades: Board["trades"] = [], height = 60)
{
    const history = chartSeries(game, stockKey, trades).filter((point) => point.value !== null);
    const values = history.map((point) => point.value ?? 0);
    const start = values[0] ?? 0;
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;
    const lastRound = fitToHistory ? Math.max(1, Math.ceil(lastItem(history)?.round ?? 0)) : chartRoundCount(game);
    const layout = tradeMarkerLayout(history, 164, height, lastRound, 8);
    const inset = history.some((point) => point.trades) ? 8 : 4;
    const top = 4 + layout.padding.top;
    const bottom = Math.max(top, height - 4 - layout.padding.bottom);
    const positions = history.map((point) => ({
        ...point,
        x: inset + point.round / lastRound * (180 - inset * 2),
        y: max === min ? (top + bottom) / 2 : bottom - ((point.value ?? 0) - min) / (max - min) * (bottom - top),
    }));
    const points = positions.map(({ x, y }) => `${x},${y}`).join(" ");

    return { start, min, max, points, layout, markers: positions, height };
}
