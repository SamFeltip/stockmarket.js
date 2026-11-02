import { ConvexProvider, ConvexReactClient } from "convex/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StockPanel } from "../src/StockPanel";
import { api } from "../convex/_generated/api";
import { setup } from "./game-setup";

it("compares the current quote to the game's opening quote, with rising, falling and unchanged states", async () =>
{
    const { sam } = await setup();
    const board = await sam.query(api.board.get, { code: "test" });
    const stock = board.stocks.find((item) => item.display)!;

    board.game.priceHistory = [{ period: 0, prices: [{ stockKey: stock.key, value: 4 }] }];

    for (const [price, tone, direction, amount] of [
        [4.5, "success", "plus", "0.50"],
        [3.25, "danger", "minus", "0.75"],
        [4, "secondary", "plus", "0.00"],
    ] as const)
    {
        board.game.prices = [{ stockKey: stock.key, value: price }];
        const html = renderToStaticMarkup(
            <ConvexProvider client={new ConvexReactClient("https://test.convex.cloud")}><MemoryRouter><StockPanel board={board} stock={stock} /></MemoryRouter></ConvexProvider>,
        );

        expect(html).toContain(`stock-chart-change text-${tone}`);
        expect(html).toContain(`Price change since start: ${direction} £${amount}`);
    }
});
