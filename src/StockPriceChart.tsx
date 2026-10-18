import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { priceSeries } from "./price-history";
import type { Board, Stock } from "./types";

const priceLabel = (value: number) => `£${value.toFixed(2)}`;

export default function StockPriceChart({ game, stock }: { game: Board["game"]; stock: Stock })
{
    const data = priceSeries(game, stock.key);
    const known = data.filter((point) => point.value !== null);

    return (
        <>
            <div className="stock-price-chart" aria-label={`${stock.name} price per share by round`}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }} accessibilityLayer>
                        <CartesianGrid strokeDasharray="2 3" vertical={false} stroke="#d4d9d2" />
                        <XAxis
                            dataKey="round"
                            type="number"
                            domain={[0, game.periodCount + 1]}
                            ticks={data.map((point) => point.round)}
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
                        <Tooltip labelFormatter={(round) => Number(round) === 0 ? "Start" : `Round ${Number(round)}`} formatter={(value) => [priceLabel(Number(value)), "Share price"]} />
                        <Line
                            type="linear"
                            dataKey="value"
                            stroke="#56a8f5"
                            strokeWidth={2}
                            dot={{ r: known.length === 1 ? 4 : 2, fill: "#56a8f5", strokeWidth: 0 }}
                            activeDot={{ r: 5 }}
                            connectNulls={false}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            {known.length === 1 && <p className="stock-chart-hint">More prices appear after each round settles.</p>}
            <table className="visually-hidden">
                <caption>
                    {stock.name}
                    {" price history"}
                </caption>
                <thead>
                    <tr>
                        <th scope="col">Round</th>
                        <th scope="col">Price per share</th>
                    </tr>
                </thead>
                <tbody>
                    {known.map((point) => (
                        <tr key={point.round}>
                            <th scope="row">{point.round === 0 ? "Start" : `Round ${point.round}`}</th>
                            <td>{priceLabel(point.value ?? 0)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
}
