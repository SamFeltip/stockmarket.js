import { expect, it } from "vitest";
import { bankruptcyPeriod, purchaseCost } from "../shared/debenture";

it("refunds actual remaining purchases, consuming oldest lots on ordinary sales", () =>
{
    const events = [
        { kind: "buy", stockKey: 8, quantity: 2000, unitPrice: 2 },
        { kind: "buy", stockKey: 8, quantity: 3000, unitPrice: 3 },
        { kind: "sell", stockKey: 8, quantity: 3000 },
        { kind: "buy", stockKey: 9, quantity: 1000, unitPrice: 9 },
    ];

    expect(purchaseCost(8, 2000, events)).toBe(6000);
    expect(purchaseCost(8, 3000, events)).toBeNull();
    expect(purchaseCost(8, 0, events)).toBeNull();
    expect(purchaseCost(8, 1000, [{ kind: "buy", stockKey: 8, quantity: 1000 }])).toBeNull();
    expect(purchaseCost(8, 1000, [...events, { kind: "debenture", stockKey: 8 },
        { kind: "buy", stockKey: 8, quantity: 1000, unitPrice: 4 }])).toBe(4000);
});

it("dates bankruptcy from the fall to zero and restarts the window only after recovery and another bankruptcy", () =>
{
    const history = [2.5, 0, 0, 0, 1, 0].map((value, period) => ({ period, prices: [{ stockKey: 8, value }] }));

    expect(bankruptcyPeriod(8, history, 0)).toBeNull();
    expect(bankruptcyPeriod(8, history, 1)).toBe(1);
    expect(bankruptcyPeriod(8, history, 3)).toBe(1);
    expect(bankruptcyPeriod(8, history, 4)).toBeNull();
    expect(bankruptcyPeriod(8, history, 5)).toBe(5);
    expect(bankruptcyPeriod(8, history.slice(1, 3), 2)).toBeNull();
});
