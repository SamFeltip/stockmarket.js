import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Board, Stock } from "./types";

const priceLabel = (value: number) => `£${value.toFixed(2)}`;

export default function StockPriceChart({ game, stock }: { game: Board["game"]; stock: Stock })
{
    const history = game.priceHistory ?? [{ period: game.currentPeriod, prices: game.prices }];
    const data = history.flatMap((snapshot) =>
    {
        const price = snapshot.prices.find((item) => item.stockKey === stock.key);

        return price ? [{ round: snapshot.period === 0 ? "Start" : `Round ${snapshot.period}`, value: price.value }] : [];
    });

    return (
        <>
            <div className="stock-price-chart" aria-label={`${stock.name} price per share by round`}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }} accessibilityLayer>
                        <CartesianGrid strokeDasharray="2 3" vertical={false} stroke="#d4d9d2" />
                        <XAxis dataKey="round" tickLine={false} axisLine={false} minTickGap={24} tick={{ fontSize: 10 }} />
                        <YAxis
                            domain={[0, "auto"]}
                            tickFormatter={priceLabel}
                            tickLine={false}
                            axisLine={false}
                            width={48}
                            tick={{ fontSize: 10 }}
                        />
                        <Tooltip formatter={(value) => [priceLabel(Number(value)), "Share price"]} />
                        <Line
                            type="linear"
                            dataKey="value"
                            stroke="#56a8f5"
                            strokeWidth={2}
                            dot={{ r: data.length === 1 ? 4 : 2, fill: "#56a8f5", strokeWidth: 0 }}
                            activeDot={{ r: 5 }}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            {data.length === 1 && <p className="stock-chart-hint">More prices appear after each round settles.</p>}
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
                    {data.map((point) => (
                        <tr key={point.round}>
                            <th scope="row">{point.round}</th>
                            <td>{priceLabel(point.value)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
}
