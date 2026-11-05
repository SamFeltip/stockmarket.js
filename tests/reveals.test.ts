import { expect, it } from "vitest";
import { revealStocks } from "../src/reveals";

it("visits each stock once, including empty stocks, before additional insights", () =>
{
    const stocks = [{ key: 14, display: false }, { key: 8, display: true }, { key: 9, display: true }];
    const insights = [{ stockKey: 8 }, { stockKey: 14 }, { stockKey: 8 }];

    expect(revealStocks(stocks, insights).map((stock) => stock.key)).toEqual([8, 9, 14]);
    expect(revealStocks(stocks, []).map((stock) => stock.key)).toEqual([8, 9]);
});

it("reveals cash exactly once after all stock groups, even when no cash cards were dealt", async () =>
{
    const { revealGroups } = await import("../src/reveals");
    const { cashStock } = await import("../shared/chance-cards");
    const stocks = [cashStock, { ...cashStock, key: 8, display: true }];

    expect(revealGroups(stocks, [{ stockKey: cashStock.key }]).map((stock) => stock.key)).toEqual([8, cashStock.key]);
    expect(revealGroups(stocks, []).map((stock) => stock.key)).toEqual([8, cashStock.key]);
});

it("keeps chance cards out of the stock reveal sequence", async () =>
{
    const { revealGroups } = await import("../src/reveals");
    const { cashStock, chanceStockKey } = await import("../shared/chance-cards");
    const stocks = [{ ...cashStock, key: 8, display: true },
        { ...cashStock, key: chanceStockKey, name: "Share Suspended" }];

    expect(revealGroups(stocks, [{ stockKey: chanceStockKey }]).map((stock) => stock.key))
        .toEqual([8, cashStock.key]);
});
