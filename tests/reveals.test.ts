import { expect, it } from "vitest";
import { revealStocks } from "../src/reveals";

it("visits each stock once, including empty stocks, before additional insights", () =>
{
    const stocks = [{ key: 14, display: false }, { key: 8, display: true }, { key: 9, display: true }];
    const insights = [{ stockKey: 8 }, { stockKey: 14 }, { stockKey: 8 }];

    expect(revealStocks(stocks, insights).map((stock) => stock.key)).toEqual([8, 9, 14]);
    expect(revealStocks(stocks, []).map((stock) => stock.key)).toEqual([8, 9]);
});
