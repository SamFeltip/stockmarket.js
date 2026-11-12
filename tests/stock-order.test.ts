import { expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { setup } from "./game-setup";
import { revealGroups } from "../src/reveals";

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

for (const [pack, keys] of [
    ["classic", [7, 8, 9, 10, 11, 12]],
    ["frantic", [8, 9, 10, 11, 7, 12]],
    ["tech", [104, 106, 105, 101, 103, 102]],
    ["crashing", [7, 8, 9, 10, 11, 12]],
] as const)
{
    it(`shares the same ${pack} volatility order for phone, spectator, TV and reveals`, async () =>
    {
        const { t, sam } = await setup();

        await sam.mutation(api.games.setPack, { code: "test", pack });
        await sam.mutation(api.games.start, { code: "test" });
        const phone = await sam.query(api.board.get, { code: "test" });
        const stocks = phone.stocks.filter((stock) => stock.display);
        const scores = stocks.map((stock) => stock.variation);

        expect(stocks.map((stock) => stock.key)).toEqual(keys);
        expect(scores).toEqual(scores.toSorted((a, b) => a - b));
        await t.run((context) => context.db.patch(phone.game._id, { status: "closed" }));
        const tv = (await t.query(api.tv.board, { code: "test" }))!;

        expect(tv.stocks.map((stock) => stock.key)).toEqual(keys);
        expect(revealGroups(tv.reveal!.stocks, tv.reveal!.insights).filter((stock) => stock.display)
            .map((stock) => stock.key)).toEqual(keys);
    });
}
