import type { ChartPoint, ChartTrade } from "./price-history";

export const periodLabel = (round: number) => round === 0 ? "Start" : `Period ${Math.ceil(round)}`;

export const tradeLabel = (trade: ChartTrade) =>
    `${trade.title} ${trade.quantity > 0 ? "bought" : "sold"} ${Math.abs(trade.quantity).toLocaleString("en-GB")} shares`;

export function tooltipLabel(round: number, trades?: ChartTrade[])
{
    return trades ? (
        <>
            {periodLabel(round)}
            {trades.map((trade, index) => (
                <div key={index}>
                    {trade.bargainRound !== undefined && trade.bargainRound !== trades[index - 1]?.bargainRound
                      && <strong className="d-block">{`Round ${trade.bargainRound}`}</strong>}
                    <img className="me-1 rounded" src={trade.imageRoot} width={16} height={16} alt="" />
                    {tradeLabel(trade)}
                </div>
            ))}
        </>
    ) : periodLabel(round);
}

export function tradeMarkerLayout(data: ChartPoint[], plotWidth: number, height: number, rounds: number)
{
    const positions = data.filter((point) => point.trades).map((point) => point.round);
    let gap = Infinity;
    for (let index = 1; index < positions.length; index++)
    {
        gap = Math.min(gap, positions[index] - positions[index - 1]);
    }

    let maxBuys = 0;
    let maxSells = 0;
    for (const { trades } of data)
    {
        if (trades)
        {
            const buys = trades.filter((trade) => trade.quantity > 0).length;

            maxBuys = Math.max(maxBuys, buys);
            maxSells = Math.max(maxSells, trades.length - buys);
        }
    }

    const horizontalLimit = gap === Infinity ? 16 : Math.floor(gap * plotWidth / rounds) - 2;
    // Leave room for the price movement even when one period has many trades.
    const markerBudget = Math.max(0, (height - 38) * 0.65);
    const stackHeight = Math.max(maxBuys, maxSells, 1);
    const verticalLimit = Math.floor(markerBudget / (2 * stackHeight)) - 3;
    const size = Math.max(1, Math.min(16, horizontalLimit, Math.floor((height - 52) / 2) - 4,
        Math.max(10, verticalLimit)));
    const stride = size + 3;
    const levels = size < 10 ? 1 : Math.max(1, Math.floor(markerBudget / (2 * stride)));
    const padding = { top: Math.min(levels, maxBuys) * stride, bottom: Math.min(levels, maxSells) * stride };

    return { size, stride, levels, padding };
}

export function TradeStack({ trades, x, y, layout }: {
    trades: ChartTrade[]; x: number; y: number; layout: ReturnType<typeof tradeMarkerLayout>;
})
{
    const { size, stride, levels } = layout;

    return (
        <g data-trade-column="" data-trade-period={trades[0].period + 1} data-trade-round={trades[0].bargainRound}>
            <title>{trades.map((trade) => tradeLabel(trade)).join("\n")}</title>
            {([true, false] as const).map((buy) =>
            {
                const side = trades.filter((trade) => (trade.quantity > 0) === buy);
                const colour = buy ? "#198754" : "#c5283d";

                return side.slice(0, levels).map((trade, index) =>
                {
                    const remaining = side.length - index;
                    const compact = size < 10 || (index === levels - 1 && remaining > 1);
                    const left = x - size / 2;
                    const top = buy ? y - stride * (index + 1) : y + 3 + stride * index;

                    return (
                        <g data-trade-side={buy ? "buy" : "sell"} key={`${buy}:${index}`}>
                            {!compact && <image href={trade.imageRoot} x={left} y={top} width={size} height={size} />}
                            <rect
                                x={left}
                                y={top}
                                width={size}
                                height={size}
                                rx={2}
                                fill={compact ? colour : "none"}
                                stroke={colour}
                                strokeWidth={1}
                            />
                            {compact && (
                                <text x={x} y={top + size * 0.72} textAnchor="middle" fill="white" fontSize={size * 0.7}>
                                    {index > 0 ? `+${remaining}` : remaining}
                                </text>
                            )}
                        </g>
                    );
                });
            })}
        </g>
    );
}
