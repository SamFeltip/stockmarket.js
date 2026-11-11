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

    const columnWidth = gap === Infinity ? 18 : gap * plotWidth / rounds;
    const horizontalLimit = columnWidth - Math.min(2, columnWidth / 4);
    // Leave room for the price movement even when one period has many trades.
    const markerBudget = Math.max(0, (height - 38) * 0.65);
    const verticalLimit = markerBudget / Math.max(1, maxBuys + maxSells);
    const size = Math.max(0, Math.min(16, horizontalLimit, verticalLimit * 0.8));
    const spacing = Math.min(3, size / 4);
    const stride = size + spacing;
    const padding = { top: maxBuys * stride, bottom: maxSells * stride };

    return { size, spacing, stride, padding };
}

export function TradeStack({ trades, x, y, layout }: {
    trades: ChartTrade[]; x: number; y: number; layout: ReturnType<typeof tradeMarkerLayout>;
})
{
    const { size, spacing, stride } = layout;
    if (size === 0)
    {
        return null;
    }

    const strokeWidth = Math.min(1, size / 6);
    const inset = strokeWidth / 2;

    return (
        <g data-trade-column="" data-trade-period={trades[0].period + 1} data-trade-round={trades[0].bargainRound}>
            <title>{trades.map((trade) => tradeLabel(trade)).join("\n")}</title>
            {([true, false] as const).map((buy) =>
            {
                const side = trades.filter((trade) => (trade.quantity > 0) === buy);
                const colour = buy ? "#198754" : "#c5283d";

                return side.map((trade, index) =>
                {
                    const left = x - size / 2;
                    const top = buy ? y - stride * (index + 1) : y + spacing + stride * index;

                    return (
                        <g data-trade-side={buy ? "buy" : "sell"} key={`${buy}:${index}`}>
                            <image href={trade.imageRoot} x={left} y={top} width={size} height={size} />
                            <rect
                                x={left + inset}
                                y={top + inset}
                                width={size - strokeWidth}
                                height={size - strokeWidth}
                                rx={Math.min(2, size / 4)}
                                fill="none"
                                stroke={colour}
                                strokeWidth={strokeWidth}
                            />
                        </g>
                    );
                });
            })}
        </g>
    );
}
