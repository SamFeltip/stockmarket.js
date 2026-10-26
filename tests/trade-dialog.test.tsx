import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { tradeUnavailableReason } from "../src/trades";
import { TradeModal } from "../src/TradeModal";
import { setup } from "./game-setup";
import { api } from "../convex/_generated/api";

const trade = { mode: "buy" as const, price: 2, quantity: 1000, available: 200_000,
    held: 2000, cash: 6000, isTurn: true, isPlaying: true, tradable: true };

describe("trade availability feedback", () =>
{
    const cases = [
        [{ isPlaying: false }, "period is closed"],
        [{ isTurn: false }, "wait for your turn"],
        [{ tradable: false }, "cannot be traded"],
        [{ price: 0 }, "cannot be traded"],
        [{ price: Number.NaN }, "cannot be traded"],
        [{ available: 0 }, "no shares available to buy"],
        [{ cash: 1999 }, "enough cash to buy 1,000"],
        [{ quantity: 0 }, "Choose at least 1,000"],
        [{ quantity: 500 }, "steps of 1,000"],
        [{ quantity: -1000 }, "positive number"],
        [{ quantity: 4000 }, "enough cash. Try fewer"],
        [{ quantity: 3000, available: 2000 }, "enough shares available"],
        [{ mode: "sell" as const, held: 0 }, "available to sell"],
        [{ mode: "sell" as const, quantity: 3000 }, "more shares than you own"],
    ] as const;
    for (const [changes, message] of cases)
    {
        it(`explains an unavailable trade: ${message}`, () =>
        {
            expect(tradeUnavailableReason({ ...trade, ...changes })).toContain(message);
        });
    }

    it("allows valid purchases and sales at their limits", () =>
    {
        expect(tradeUnavailableReason({ ...trade, quantity: 3000 })).toBe("");
        expect(tradeUnavailableReason({ ...trade, mode: "sell", quantity: 2000 })).toBe("");
    });

    it("places feedback before the footer actions without the old help text or native validation popups", async () =>
    {
        const { sam } = await setup();
        const board = await sam.query(api.board.get, { code: "test" });
        const stock = board.stocks.find((item) => item.display)!;
        const client = new ConvexReactClient("https://example.convex.cloud");
        for (const mode of ["buy", "sell"] as const)
        {
            const html = renderToStaticMarkup(
                <ConvexProvider client={client}><TradeModal board={board} stock={stock} mode={mode} /></ConvexProvider>,
            );
            const footer = html.slice(html.indexOf("modal-footer"));

            expect(footer).toContain(`${mode}-trade-feedback`);
            expect(footer.indexOf("trade-feedback")).toBeLessThan(footer.indexOf("Cancel"));
            expect(html.toLowerCase()).toContain("novalidate");
            expect(html).toContain("trade-dialog");
            expect(html).not.toContain("Trade shares in steps");
            expect(html).not.toContain("Entering cash selects");
        }

        await client.close();
    });
});
