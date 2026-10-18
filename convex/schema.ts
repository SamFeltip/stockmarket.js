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

export const difficultyValidator = v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"));

export const personalityValidator = v.union(v.literal("frankie"), v.literal("casey"), v.literal("ada"), v.literal("felix"), v.literal("morgan"));

export const actionValidator = v.union(v.object({ kind: v.literal("pass") }), v.object({
    kind: v.union(v.literal("buy"), v.literal("sell")), stockKey: v.number(), quantity: v.number(),
}));

const pricesValidator = v.array(v.object({ stockKey: v.number(), value: v.number() }));

export default defineSchema({
    ...authTables,
    users: defineTable({
        name: v.string(), email: v.optional(v.string()), profileRoot: v.string(),
        emailVerificationTime: v.optional(v.number()), isAnonymous: v.optional(v.boolean()),
    }).index("email", ["email"]),
    stocks: defineTable(stockFields).index("by_key", ["key"]),
    insights: defineTable(insightFields).index("by_key", ["key"]),
    games: defineTable({
        code: v.string(), hostId: v.id("users"), currentUserId: v.optional(v.id("users")),
        currentPlayerId: v.optional(v.id("players")), npcDifficulty: v.optional(difficultyValidator),
        rulesVersion: v.optional(v.number()), rosterRevision: v.optional(v.number()),
        catalogVersion: v.optional(v.string()),
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
        gameId: v.id("games"), userId: v.optional(v.id("users")),
        controller: v.optional(v.union(v.object({ kind: v.literal("human"), userId: v.id("users") }),
            v.object({ kind: v.literal("npc"), personality: personalityValidator }))),
        npcDifficulty: v.optional(difficultyValidator),
        seatOrder: v.optional(v.number()), periodStartRanking: v.optional(v.number()), cash: v.number(),
        active: v.boolean(),
        holdings: v.array(v.object({ stockKey: v.number(), quantity: v.number() })),
    }).index("by_game", ["gameId"]).index("by_user", ["userId"])
        .index("by_game_user", ["gameId", "userId"]),
    playerInsights: defineTable({
        gameId: v.id("games"), playerId: v.id("players"), period: v.number(),
        stockKey: v.number(), description: v.string(), value: v.number(), resolved: v.boolean(),
        catalogCardId: v.optional(v.string()),
    }).index("by_game_period", ["gameId", "period"]).index("by_player_period", ["playerId", "period"]),
    gameCatalogs: defineTable({ gameId: v.id("games"), version: v.string(), cards: v.array(v.object({
        id: v.string(), stockKey: v.number(), value: v.number(), description: v.string(),
    })) }).index("by_game", ["gameId"]),
    gameActions: defineTable({ gameId: v.id("games"), period: v.number(), turn: v.number(),
        actorPlayerId: v.id("players"), action: actionValidator,
    }).index("by_game_period_turn", ["gameId", "period", "turn"]),
    periodSummaries: defineTable({ gameId: v.id("games"), period: v.number(), opening: pricesValidator, settled: pricesValidator,
    }).index("by_game_period", ["gameId", "period"]),
    npcGameConfigs: defineTable({ gameId: v.id("games"), queue: v.array(personalityValidator),
        rosterSeed: v.string(), engineVersion: v.number(), tuningVersion: v.number(),
    }).index("by_game", ["gameId"]),
    npcStates: defineTable({ gameId: v.id("games"), playerId: v.id("players"), memory: v.string(), version: v.number(),
    }).index("by_player", ["playerId"]).index("by_game", ["gameId"]),
    npcTraces: defineTable({ gameId: v.id("games"), playerId: v.id("players"), period: v.number(), turn: v.number(),
        action: actionValidator, reason: v.string(), diagnostic: v.optional(v.string()),
        elapsedMs: v.number(), attempts: v.number(), engineVersion: v.number(),
    }).index("by_game", ["gameId"]),
    npcTurns: defineTable({ gameId: v.id("games"), playerId: v.id("players"), period: v.number(), turn: v.number(),
        generation: v.string(), seed: v.string(), due: v.number(), enqueuedAt: v.number(), attempts: v.number(),
        lastError: v.optional(v.string()),
    }).index("by_game", ["gameId"]).index("by_due", ["due"]),
    feed: defineTable({
        gameId: v.id("games"), period: v.number(), title: v.string(),
        message: v.string(), imageRoot: v.string(), colour: v.string(),
        stockKey: v.optional(v.number()), quantity: v.optional(v.number()),
    }).index("by_game", ["gameId"]),
});
