import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const stockFields = {
    key: v.number(), name: v.string(), startingValue: v.number(), imagePath: v.string(),
    secondaryImagePath: v.string(), variation: v.number(), display: v.boolean(),
};

export const insightFields = {
    key: v.number(), stockKey: v.number(), description: v.string(), value: v.number(),
};

export default defineSchema({
    ...authTables,
    users: defineTable({
        name: v.string(), email: v.optional(v.string()), profileRoot: v.string(),
        emailVerificationTime: v.optional(v.number()), isAnonymous: v.optional(v.boolean()),
    }).index("email", ["email"]),
    stocks: defineTable(stockFields).index("by_key", ["key"]),
    insights: defineTable(insightFields).index("by_key", ["key"]),
    games: defineTable({
        code: v.string(), hostId: v.id("users"), currentUserId: v.id("users"),
        periodCount: v.number(), currentPeriod: v.number(), turn: v.number(),
        status: v.union(v.literal("waiting"), v.literal("playing"), v.literal("closed"),
            v.literal("special_insights"), v.literal("finished")),
        prices: v.array(v.object({ stockKey: v.number(), value: v.number() })),
        priceHistory: v.optional(v.array(v.object({
            period: v.number(), prices: v.array(v.object({ stockKey: v.number(), value: v.number() })),
        }))),
        suspended: v.array(v.number()),
    }).index("by_code", ["code"]),
    players: defineTable({
        gameId: v.id("games"), userId: v.id("users"), cash: v.number(), active: v.boolean(),
        holdings: v.array(v.object({ stockKey: v.number(), quantity: v.number() })),
    }).index("by_game", ["gameId"]).index("by_user", ["userId"])
        .index("by_game_user", ["gameId", "userId"]),
    playerInsights: defineTable({
        gameId: v.id("games"), playerId: v.id("players"), period: v.number(),
        stockKey: v.number(), description: v.string(), value: v.number(), resolved: v.boolean(),
    }).index("by_game_period", ["gameId", "period"]),
    feed: defineTable({
        gameId: v.id("games"), period: v.number(), title: v.string(),
        message: v.string(), imageRoot: v.string(), colour: v.string(),
        stockKey: v.optional(v.number()), quantity: v.optional(v.number()),
    }).index("by_game", ["gameId"]),
});
