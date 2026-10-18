import { expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { previewRound } from "../src/round-preview";
import { priceSeries } from "../src/price-history";
import { setup } from "./game-setup";

it("updates revealed wealth and charts before advancing, matching settled stock and currency values", async () =>
{
    const { t, sam } = await setup();

    await sam.mutation(api.games.start, { code: "test" });
    const initial = await sam.query(api.board.get, { code: "test" });

    await t.run(async (context) =>
    {
        await context.db.patch(initial.game._id, { status: "closed", suspended: [9] });
        await context.db.patch(initial.player._id, { cash: 1000, holdings: [
            { stockKey: 8, quantity: 1000 }, { stockKey: 9, quantity: 1000 },
        ] });
        await context.db.insert("stocks", { key: 13, name: "currency", display: false, variation: 0,
            startingValue: 0, imagePath: "", secondaryImagePath: "" });
        const insights = await context.db.query("playerInsights").collect();
        for (const insight of insights)
        {
            await context.db.patch(insight._id, { value: 0 });
        }

        await context.db.patch(insights[0]._id, { stockKey: 8, value: -10 });
        await context.db.patch(insights[1]._id, { stockKey: 9, value: 10 });
        await context.db.patch(insights[2]._id, { stockKey: 13, value: 0.1, playerId: initial.player._id });
    });
    const before = await sam.query(api.board.get, { code: "test" });
    const partial = previewRound(before, before.insights.filter((insight) => insight.stockKey === 8), [8]);

    expect(partial.players[0].netWorth).toBe(5000);
    expect(before.players[0].netWorth).toBe(7500);
    expect(priceSeries(partial.game, 8)[1].value).toBe(0);
    expect(priceSeries(partial.game, 9)[1].value).toBeNull();
    const complete = previewRound(before, before.insights, before.stocks.map((stock) => stock.key));

    expect(complete.players[0].cash).toBe(1100);
    expect(complete.players[0].netWorth).toBe(5100);
    expect(complete.game.prices.find((price) => price.stockKey === 9)?.value).toBe(4);
    await sam.mutation(api.rounds.next, { code: "test", expectedPeriod: 0 });
    const settled = await sam.query(api.board.get, { code: "test" });

    expect(complete.game.prices).toEqual(settled.game.prices);
    expect(complete.game.priceHistory).toEqual(settled.game.priceHistory);
    expect(complete.players.map((player) => [player.cash, player.netWorth, player.ranking]))
        .toEqual(settled.players.map((player) => [player.cash, player.netWorth, player.ranking]));
});
