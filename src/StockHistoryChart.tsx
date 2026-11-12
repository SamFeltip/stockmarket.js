import { TradeStack } from "./TradeMarkers";
import type { stockHistory } from "./stock-history";

export function StockHistoryChart({ name, history, sparkline = false }: {
    name: string; history: ReturnType<typeof stockHistory>; sparkline?: boolean;
})
{
    const { height, points, markers, layout } = history;

    return (
        <svg
            className={sparkline ? "sparkline" : undefined}
            viewBox={`0 0 180 ${height}`}
            role="img"
            aria-label={`${name} price history`}
        >
            <path d={sparkline ? "M0 40H180" : "M4 0V56H180"} fill="none" stroke="#a8b2a4" />
            <polyline points={points} fill="none" stroke={sparkline ? "#204712" : "#378dde"} strokeWidth="2" />
            {markers.map(({ round, x, y, trades }) =>
                trades && <TradeStack key={round} trades={trades} x={x} y={y} layout={layout} />)}
        </svg>
    );
}
