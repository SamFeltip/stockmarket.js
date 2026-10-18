import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { members } from "./library";
export const backfillSeats = internalMutation({
    args: { cursor: v.union(v.string(), v.null()) },
    handler: async (context, { cursor }) =>
    {
        const page = await context.db.query("games").paginate({ cursor, numItems: 100 });
        for (const game of page.page)
        {
            const seats = await members(context, game._id);
            for (const [index, seat] of seats.entries())
            {
                if (!seat.controller && seat.userId)
                {
                    await context.db.patch(seat._id, { controller: { kind: "human", userId: seat.userId }, seatOrder: seat.seatOrder ?? index });
                }
                else if (seat.seatOrder === undefined)
                {
                    await context.db.patch(seat._id, { seatOrder: index });
                }
            }

            const current = seats.find((seat) => seat.userId === game.currentUserId);

            await context.db.patch(game._id, {
                currentPlayerId: game.currentPlayerId ?? current?._id, rulesVersion: game.rulesVersion ?? 1,
                npcDifficulty: game.npcDifficulty ?? "medium", rosterRevision: game.rosterRevision ?? 0,
            });
        }

        return { cursor: page.continueCursor, done: page.isDone };
    },
});

export const validateSeats = internalMutation({
    args: { cursor: v.optional(v.union(v.string(), v.null())) },
    handler: async (context, { cursor }) =>
    {
        const page = await context.db.query("games").paginate({ cursor: cursor ?? null, numItems: 100 });
        const games = page.page;
        const invalid: string[] = [];
        for (const game of games)
        {
            const seats = await members(context, game._id);
            if (!seats.some((seat) => seat._id === game.currentPlayerId)
              || seats.some((seat) => !seat.controller || seat.seatOrder === undefined
                || (seat.controller.kind === "human" && seat.controller.userId !== seat.userId))
              || new Set(seats.map((seat) => seat.seatOrder)).size !== seats.length)
            {
                invalid.push(game._id);
            }
        }

        return { checked: games.length, invalid, done: page.isDone, cursor: page.continueCursor };
    },
});
