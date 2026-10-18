import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { GameResults } from "../src/GameResults";
import { api } from "../convex/_generated/api";
import { setup } from "./game-setup";

it("shows every final portfolio in net-worth order with share prices, values and cash", async () =>
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
    expect(html).toContain("2. sam");
    expect(html.indexOf("1. bob")).toBeLessThan(html.indexOf("2. sam"));
});
