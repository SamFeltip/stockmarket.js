import { ConvexProvider, ConvexReactClient } from "convex/react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { DebentureModal } from "../src/DebentureModal";
import { bankruptGame } from "./debenture-setup";

it("shows and redeems the current user's entire holding at the game's original price, regardless of purchase costs", async () =>
{
    const { t, sam, bob, board, insightId, command } = await bankruptGame();

    await t.run(async (context) =>
    {
        await context.db.patch(board.player._id, { holdings: [{ stockKey: 8, quantity: 68_000 }] });
        await context.db.patch(board.game._id, { priceHistory: board.game.priceHistory!.map((snapshot) => ({
            ...snapshot, prices: snapshot.prices.map((price) => snapshot.period === 0 && price.stockKey === 8
                ? { ...price, value: 2 } : price),
        })) });
        // Changing later catalogue prices must not rewrite a recorded game's opening price.
        const stock = (await context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", 8)).unique())!;

        await context.db.patch(stock._id, { startingValue: 9 });

        for (const action of await context.db.query("gameActions").collect())
        {
            await context.db.patch(action._id, { unitPrice: 0.52 });
        }
    });
    const current = await sam.query(api.board.get, { code: "test" });

    expect(current.debentureOffers).toContainEqual({ stockKey: 8, quantity: 68_000, unitPrice: 2,
        amount: 136_000, claimUntilPeriod: 2, unavailableReason: null });
    expect((await bob.query(api.board.get, { code: "test" })).debentureOffers).toEqual([]);
    const client = new ConvexReactClient("https://debenture-opening.invalid");

    try
    {
        const html = renderToStaticMarkup(
            <ConvexProvider client={client}>
                <DebentureModal board={current} insightId={insightId} used={false} />
            </ConvexProvider>,
        );

        expect(html).toContain("68,000 stocks");
        expect(html).toContain("£2.00 each");
        expect(html).not.toContain("≈");
        expect(html).not.toContain("£0.52");
    }
    finally
    {
        await client.close();
    }

    await sam.mutation(api.trading.redeemDebenture, command);
    const after = await sam.query(api.board.get, { code: "test" });

    expect(after.player.cash).toBe(current.player.cash + 136_000);
    expect(after.player.holdings.find((holding) => holding.stockKey === 8)?.quantity).toBe(0);
    expect(after.feed[0].debenturePayout).toBe(136_000);
});
