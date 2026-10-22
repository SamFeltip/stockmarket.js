import { expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { setup } from "./game-setup";

it("uses corrected volatility order even for an existing catalog", async () =>
{
    const { t, sam } = await setup();

    await t.run(async (context) =>
    {
        const stock = await context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", 7)).unique();
        if (stock)
        {
            await context.db.patch(stock._id, { variation: 4 });
        }
    });
    const board = await sam.query(api.board.get, { code: "test" });

    expect(board.stocks.filter((stock) => stock.display).map((stock) => stock.name)).toEqual([
        "Trusthouse Forte", "UB", "Legal & General", "Thames", "Saatchi & Saatchi", "Natwest",
    ]);
});

it("uses corrected volatility order for every public TV stock list", async () =>
{
    const { t, sam } = await setup();

    await t.run(async (context) =>
    {
        const stock = await context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", 7)).unique();
        if (stock)
        {
            await context.db.patch(stock._id, { variation: 6 });
        }
    });
    await sam.mutation(api.games.start, { code: "test" });
    const phone = await sam.query(api.board.get, { code: "test" });
    const tv = await t.query(api.tv.board, { code: "test" });

    expect(tv?.stocks.map((stock) => stock.key))
        .toEqual(phone.stocks.filter((stock) => stock.display).map((stock) => stock.key));
});
