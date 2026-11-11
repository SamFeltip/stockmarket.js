import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, usePlotArea, XAxis, YAxis, ZIndexLayer } from "recharts";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { chartRoundAxis, chartSeries } from "./price-history";
import type { ChartPoint, ChartTrade } from "./price-history";
import type { Board, Stock } from "./display-types";

const chartMargin = { top: 24, right: 12, bottom: 0, left: 0 };
const emptyTrades: ChartTrade[] = [];
const priceLabel = (value: number) => `£${value.toFixed(2)}`;
const roundLabel = (round: number) => round === 0 ? "Start" : `Round ${Math.ceil(round)}`;
const tradeLabel = (trade: ChartTrade) =>
    `${trade.title} ${trade.quantity > 0 ? "bought" : "sold"} ${Math.abs(trade.quantity).toLocaleString("en-GB")} shares`;

const tooltipStyle = {
    background: "white", color: "#17251c", border: "1px solid #adb5aa", padding: "0.4rem",
    fontSize: "0.8rem", maxWidth: "min(12rem, 55vw)", whiteSpace: "normal",
} as const;

function tooltipLabel(round: number, trade?: ChartTrade)
{
    return trade ? (
        <>
            {roundLabel(round)}
            <br />
            <img className="me-1 rounded" src={trade.imageRoot} width={20} height={20} alt="" />
            {tradeLabel(trade)}
        </>
    ) : roundLabel(round);
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
    const [touch, setTouch] = useState<TouchSelection | null>();
    const data = useMemo(() => chartSeries(game, stock.key, trades), [game, stock.key, trades]);
    const known = data.filter((point) => point.value !== null);
    const { roundCount, tickStep, ticks } = chartRoundAxis(game);

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
                aria-label={`${stock.name} price per share by round`}
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
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={data} margin={chartMargin}>
                        {ticks.slice(0, -1).filter((_, index) => index % 2 === 0)
                            .map((period) => (
                                <ReferenceArea
                                    key={period}
                                    x1={period}
                                    x2={Math.min(roundCount, period + tickStep)}
                                    fill="#f3f4f3"
                                    fillOpacity={1}
                                    stroke="none"
                                    zIndex={-110}
                                />
                            ))}
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
                            width={48}
                            tick={{ fontSize: 10 }}
                        />
                        <Tooltip
                            active={touch === undefined ? undefined : false}
                            isAnimationActive={false}
                            contentStyle={tooltipStyle}
                            labelFormatter={(label) =>
                            {
                                const round = Number(label);

                                return tooltipLabel(round, data.find((point) => point.round === round)?.trade);
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

                                const trade = point?.trade;
                                if (!trade)
                                {
                                    return <circle cx={cx} cy={cy} r={known.length === 1 ? 4 : 2} fill="#56a8f5" />;
                                }

                                const colour = trade.quantity > 0 ? "#198754" : "#c5283d";

                                return (
                                    <g>
                                        <title>{tradeLabel(trade)}</title>
                                        <image href={trade.imageRoot} x={cx - 8} y={cy - 20} width={16} height={16} />
                                        <rect
                                            x={cx - 8}
                                            y={cy - 20}
                                            width={16}
                                            height={16}
                                            rx={2}
                                            fill="none"
                                            stroke={colour}
                                            strokeWidth={2}
                                        />
                                        <path d={`M${cx} ${cy - 4}v4`} stroke={colour} />
                                    </g>
                                );
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
                            ...tooltipStyle, position: "absolute", top: "0.25rem", pointerEvents: "none",
                            left: `clamp(0.25rem, ${touch.left + 8}px, calc(100% - min(12rem, 55vw) - 0.25rem))`,
                        }}
                    >
                        {tooltipLabel(touch.point.round, touch.point.trade)}
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
                            <th scope="col">Round</th>
                            <th scope="col">Price per share</th>
                            <th scope="col">Trade</th>
                        </tr>
                    </thead>
                    <tbody>
                        {known.map((point) => (
                            <tr key={point.round}>
                                <th scope="row">{roundLabel(point.round)}</th>
                                <td>{priceLabel(point.value ?? 0)}</td>
                                <td>{point.trade && tradeLabel(point.trade)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}
