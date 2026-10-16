import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { fail, feedItem, member, members } from "./library";

export const play = mutation({
    args: {
        code: v.string(), expectedTurn: v.number(),
        stockKey: v.optional(v.number()), quantity: v.optional(v.number()),
    },
    handler: async (context, { code, expectedTurn, stockKey, quantity }) =>
    {
        const { game, user, player } = await member(context, code);
        if (game.status !== "playing" || game.currentUserId !== user._id)
        {
            fail("It is not your turn");
        }

        // Reject duplicate clicks and requests made against an obsolete board, even in a solo game.
        if (game.turn !== expectedTurn)
        {
            fail("The turn has changed; try again");
        }

        const players = await members(context, game._id);
        let message = "passed their go";
        if (stockKey !== undefined)
        {
            const stock = await context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", stockKey)).unique();
            const price = game.prices.find((item) => item.stockKey === stockKey)?.value;
            const holding = player.holdings.find((item) => item.stockKey === stockKey);
            if (!stock?.display || price === undefined || !holding || price <= 0)
            {
                fail("This stock cannot be traded");
            }

            if (!quantity || !Number.isSafeInteger(quantity) || quantity % 1000 !== 0)
            {
                fail("Trade a positive number of shares in lots of 1000");
            }

            const available = 100_000 - players.reduce((sum, item) => sum
              + (item.holdings.find((share) => share.stockKey === stockKey)?.quantity ?? 0), 0);
            const cost = quantity * price;
            if (quantity > available)
            {
                fail("Not enough shares available");
            }

            if (holding.quantity + quantity < 0)
            {
                fail("Not enough shares to sell");
            }

            if (player.cash < cost)
            {
                fail("Not enough cash");
            }

            await context.db.patch(player._id, {
                cash: player.cash - cost,
                holdings: player.holdings.map((item) => item.stockKey === stockKey
                    ? { ...item, quantity: item.quantity + quantity } : item),
            });
            message = `${quantity > 0 ? "bought" : "sold"} ${Math.abs(quantity)} shares in ${stock.name}`;
        }
        else if (quantity !== undefined)
        {
            fail("Choose a stock");
        }

        await feedItem(context, game, user.name, message, user.profileRoot);
        const turn = game.turn + 1;
        const index = players.findIndex((seat) => seat.userId === user._id);

        await context.db.patch(game._id, {
            turn, currentUserId: players[(index + 1) % players.length].userId,
            status: turn >= players.length * 3 ? "closed" : "playing",
        });
    },
});
