import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { fail, member } from "./library";
import { applyTurn } from "./game/commands";
import { enqueueNextNpcIfNeeded } from "./npc/scheduling";
import type { Action } from "../packages/game-contracts/src";
export const play = mutation({
    args: { code: v.string(), expectedTurn: v.number(), expectedPeriod: v.optional(v.number()),
        stockKey: v.optional(v.number()), quantity: v.optional(v.number()) },
    handler: async (context, { code, expectedTurn, expectedPeriod, stockKey, quantity }) =>
    {
        const { game, user, player } = await member(context, code);
        if (expectedPeriod === undefined && game.rulesVersion === 2)
        {
            fail("Include the expected period; refresh the board");
        }

        let action: Action = { kind: "pass" };
        if (stockKey !== undefined)
        {
            if (quantity === undefined || quantity === 0)
            {
                fail("Trade 1000 to 5000 shares in steps of 1000, or multiples of 10000");
            }

            action = { kind: quantity > 0 ? "buy" : "sell", stockKey, quantity: Math.abs(quantity) };
        }
        else if (quantity !== undefined)
        {
            fail("Choose a stock");
        }

        await applyTurn(context, { playerId: player._id,
            expectedPeriod: expectedPeriod ?? game.currentPeriod, expectedTurn, action },
        { name: user.name, profileRoot: user.profileRoot });
        await enqueueNextNpcIfNeeded(context, game._id);
    },
});
