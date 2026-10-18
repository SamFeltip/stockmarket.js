import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { GameResults } from "../src/GameResults";
import { api } from "../convex/_generated/api";
import { stockHistory } from "../src/stock-history";
import { setup } from "./game-setup";

it("shows ranked players and the winner’s selected portfolio with share prices, values and cash", async () =>
{
    const { t, sam } = await setup();

    await sam.mutation(api.games.start, { code: "test" });
    const initial = await sam.query(api.board.get, { code: "test" });

    await t.run(async (context) =>
    {
        await context.db.patch(initial.game._id, { status: "finished" });
        await context.db.patch(initial.players[1]._id, { cash: 100_000,
            holdings: [{ stockKey: 8, quantity: 2000 }] });
    });
    const board = await sam.query(api.board.get, { code: "test" });
    const html = renderToStaticMarkup(<MemoryRouter><GameResults board={board} /></MemoryRouter>);

    expect(html).toContain("bob wins!");
    expect(html).toContain("Net worth £105,000");
    expect(html).toContain("Cash £100,000");
    expect(html).toContain("2,000 shares");
    expect(html).toContain("£2.50 per share");
    expect(html).toContain("Worth £5,000");
    expect(html).toContain("sam");
    expect(html).toContain("bob&#x27;s portfolio");
    expect(html).not.toContain("Pause charts");
    expect(html).toContain("history-viewport");
    expect(html).not.toContain("carousel-item");
    expect(html).toContain("Starting value");
});

it("plots final price history and derives starting, maximum and minimum prices from settled rounds", async () =>
{
    const { sam } = await setup();
    const { game } = await sam.query(api.board.get, { code: "test" });

    game.priceHistory = [
        { period: 0, prices: [{ stockKey: 8, value: 2.5 }] },
        { period: 1, prices: [{ stockKey: 8, value: 1 }] },
        { period: 2, prices: [{ stockKey: 8, value: 8 }] },
    ];
    expect(stockHistory(game, 8)).toMatchObject({ start: 2.5, min: 1, max: 8 });
    expect(stockHistory(game, 8).points).not.toMatch(/NaN|Infinity/);
    game.priceHistory = [{ period: 0, prices: [{ stockKey: 8, value: 2.5 }] }];
    expect(stockHistory(game, 8).points).toBe("4,30");
});
