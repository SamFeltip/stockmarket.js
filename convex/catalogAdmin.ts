import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { currentUser, fail, seedCatalog } from "./library";
import { stockFields, insightFields } from "./schema";

export const seed = internalMutation({ args: {}, handler: seedCatalog });

// Use the Convex dashboard/CLI to load additional original database records.
// Internal functions cannot be invoked by browser clients.
export const importCatalog = internalMutation({
    args: { stocks: v.array(v.object(stockFields)), insights: v.array(v.object(insightFields)) },
    handler: async (context, { stocks, insights }) =>
    {
        for (const stock of stocks)
        {
            const existing = await context.db.query("stocks").withIndex("by_key", (q) => q.eq("key", stock.key)).unique();

            await (existing ? context.db.patch(existing._id, stock) : context.db.insert("stocks", stock));
        }

        for (const insight of insights)
        {
            const existing = await context.db.query("insights").withIndex("by_key", (q) => q.eq("key", insight.key)).unique();

            await (existing ? context.db.patch(existing._id, insight) : context.db.insert("insights", insight));
        }
    },
});

export const list = query({ args: {}, handler: async (context) =>
{
    await currentUser(context);
    const stocks = await context.db.query("stocks").collect();

    return (await context.db.query("insights").collect()).toSorted((a, b) => a.key - b.key)
        .map((insight) => ({ ...insight, stock: stocks.find((stock) => stock.key === insight.stockKey) }));
} });

export const updateDescription = mutation({
    args: { insightId: v.id("insights"), description: v.string() },
    handler: async (context, { insightId, description }) =>
    {
        await currentUser(context);

        if (!description.trim() || description.length > 2000)
        {
            fail("Invalid description");
        }

        if (!await context.db.get(insightId))
        {
            fail("Insight not found");
        }

        await context.db.patch(insightId, { description: description.trim() });
    },
});
