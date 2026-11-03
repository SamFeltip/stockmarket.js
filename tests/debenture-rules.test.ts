import { expect, it } from "vitest";
import { bankruptcyPeriod } from "../shared/debenture";

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
