import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, usePlotArea, XAxis, YAxis, ZIndexLayer } from "recharts";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { chartRoundCount, chartSeries } from "./price-history";
import type { ChartPoint, ChartTrade } from "./price-history";
import type { Board, Stock } from "./display-types";
import { periodLabel, tooltipLabel, tradeLabel, tradeMarkerLayout, TradeStack } from "./TradeMarkers";

const chartMargin = { top: 8, right: 12, bottom: 0, left: 0 };
const priceAxisWidth = 48;
const emptyTrades: ChartTrade[] = [];
const priceLabel = (value: number) => `£${value.toFixed(2)}`;
const tooltipStyle = {
    background: "white", color: "#17251c", border: "1px solid #adb5aa", padding: "0.4rem",
    fontSize: "0.8rem", maxWidth: "min(12rem, 55vw)", whiteSpace: "normal",
} as const;

function PeriodBands({ rounds }: { rounds: number })
{
    const plot = usePlotArea();
    if (!plot)
    {
        return null;
    }

    const width = plot.width / rounds;

    return (
        <ZIndexLayer zIndex={-110}>
            {Array.from({ length: Math.ceil(rounds / 2) }, (_, index) => (
                <rect key={index} x={plot.x + index * 2 * width} y={plot.y} width={width} height={plot.height} fill="#f3f4f3" />
            ))}
        </ZIndexLayer>
    );
}

interface TouchSelection { point: ChartPoint; left: number }

function ChartTouchArea({ data, rounds, onSelect }: {
    data: ChartPoint[]; rounds: number; onSelect: (selection: TouchSelection) => void;
})
{
    const plot = usePlotArea();
    if (!plot)
    {
        return null;
    }

    const { x, width } = plot;

    function select(event: ReactPointerEvent<SVGRectElement>)
    {
        const bounds = event.currentTarget.getBoundingClientRect();
        const round = (event.clientX - bounds.left) / bounds.width * rounds;
        let closest: ChartPoint | undefined;
        let distance = Infinity;
        for (const point of data)
        {
            const delta = Math.abs(point.round - round);
            if (point.value !== null && delta < distance)
            {
                closest = point;
                distance = delta;
            }
        }

        if (closest)
        {
            onSelect({ point: closest, left: x + width * closest.round / rounds });
        }
    }

    return (
        <ZIndexLayer zIndex={1000}>
            <rect
                {...plot}
                fill="transparent"
                data-chart-touch-area=""
                aria-hidden="true"
                onPointerDown={(event) =>
                {
                    if (event.pointerType !== "mouse")
                    {
                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        select(event);
                    }
                }}
                onPointerMove={(event) =>
                {
                    if (event.currentTarget.hasPointerCapture(event.pointerId))
                    {
                        select(event);
                    }
                }}
            />
        </ZIndexLayer>
    );
}

export default function StockPriceChart({ game, stock, trades = emptyTrades }: {
    game: Board["game"]; stock: Stock; trades?: ChartTrade[];
})
{
    const chart = useRef<HTMLDivElement>(null);
    const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
    const [touch, setTouch] = useState<TouchSelection | null>();
    const data = useMemo(() => chartSeries(game, stock.key, trades), [game, stock.key, trades]);
    const known = data.filter((point) => point.value !== null);
    const roundCount = chartRoundCount(game);
    const tickStep = Math.max(1, Math.ceil(roundCount / 10));
    const ticks = Array.from({ length: Math.ceil(roundCount / tickStep) + 1 }, (_, index) =>
        Math.min(index * tickStep, roundCount));
    const plotWidth = chartSize.width - priceAxisWidth - chartMargin.right;
    const markers = tradeMarkerLayout(data, plotWidth, chartSize.height, roundCount);
    const tooltipHeight = Math.max(36, chartSize.height - 12);

    useEffect(() =>
    {
        function dismiss(event: PointerEvent)
        {
            if (event.target instanceof Node && !chart.current?.contains(event.target))
            {
                setTouch((current) => current === undefined ? undefined : null);
            }
        }

        document.addEventListener("pointerdown", dismiss, true);

        return () => document.removeEventListener("pointerdown", dismiss, true);
    }, []);

    return (
        <>
            <div
                ref={chart}
                className="stock-price-chart"
                aria-label={`${stock.name} price per share by period`}
                style={{ position: "relative", touchAction: "pan-y" }}
                onFocus={() => setTouch(undefined)}
                onPointerMove={(event) =>
                {
                    if (event.pointerType === "mouse" && touch !== undefined)
                    {
                        setTouch(undefined);
                    }
                }}
            >
                <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minWidth={0}
                    onResize={(width, height) => setChartSize({ width, height })}
                >
                    <LineChart data={data} margin={chartMargin}>
                        <PeriodBands rounds={roundCount} />
                        <CartesianGrid strokeDasharray="2 3" vertical={false} stroke="#b8c1b7" />
                        <XAxis
                            dataKey="round"
                            type="number"
                            domain={[0, roundCount]}
                            ticks={ticks}
                            interval={0}
                            tickFormatter={(round: number) => round === 0 ? "Start" : String(round)}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 10 }}
                        />
                        <YAxis
                            domain={[0, "auto"]}
                            tickFormatter={priceLabel}
                            tickLine={false}
                            axisLine={false}
                            width={priceAxisWidth}
                            padding={markers.padding}
                            tick={{ fontSize: 10 }}
                        />
                        <Tooltip
                            active={touch === undefined ? undefined : false}
                            isAnimationActive={false}
                            contentStyle={{ ...tooltipStyle, maxHeight: tooltipHeight, overflowY: "auto", overscrollBehavior: "contain" }}
                            wrapperStyle={{ pointerEvents: "auto" }}
                            labelFormatter={(label) =>
                            {
                                const round = Number(label);

                                return tooltipLabel(round, data.find((point) => point.round === round)?.trades);
                            }}
                            formatter={(value) => [priceLabel(Number(value)), "Share price"]}
                        />
                        <Line
                            type="linear"
                            dataKey="value"
                            stroke="#56a8f5"
                            strokeWidth={2}
                            dot={({ cx, cy, index }) =>
                            {
                                const point = data[index];
                                if (point?.value === null || cx === undefined || cy === undefined)
                                {
                                    return null;
                                }

                                return point?.trades
                                    ? <TradeStack trades={point.trades} x={cx} y={cy} layout={markers} />
                                    : <circle cx={cx} cy={cy} r={known.length === 1 ? 4 : 2} fill="#56a8f5" />;
                            }}
                            activeDot={touch === undefined ? { r: 5 } : false}
                            connectNulls={false}
                            isAnimationActive={false}
                        />
                        {touch && <ReferenceLine x={touch.point.round} stroke="#70845b" />}
                        <ChartTouchArea data={data} rounds={roundCount} onSelect={setTouch} />
                    </LineChart>
                </ResponsiveContainer>
                {touch && touch.point.value !== null && (
                    <div
                        className="stock-chart-touch-tooltip"
                        role="status"
                        style={{
                            ...tooltipStyle, position: "absolute", top: "0.25rem", maxHeight: tooltipHeight,
                            overflowY: "auto", overscrollBehavior: "contain", touchAction: "pan-y",
                            left: `clamp(0.25rem, ${touch.left + 8}px, calc(100% - min(12rem, 55vw) - 0.25rem))`,
                        }}
                    >
                        {tooltipLabel(touch.point.round, touch.point.trades)}
                        <div>{`Share price: ${priceLabel(touch.point.value)}`}</div>
                    </div>
                )}
            </div>
            {known.length === 1 && <p className="stock-chart-hint">More prices appear after each round settles.</p>}
            <div className="visually-hidden">
                <table>
                    <caption>{`${stock.name} price history`}</caption>
                    <thead>
                        <tr>
                            <th scope="col">Period</th>
                            <th scope="col">Price per share</th>
                            <th scope="col">Trades</th>
                        </tr>
                    </thead>
                    <tbody>
                        {known.map((point) => (
                            <tr key={point.round}>
                                <th scope="row">{periodLabel(point.round)}</th>
                                <td>{priceLabel(point.value ?? 0)}</td>
                                <td>{point.trades?.map((trade) => tradeLabel(trade)).join("; ")}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}
