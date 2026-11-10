import { ConvexError } from "convex/values";
import type { MutationCtx as MutationContext_, QueryCtx as QueryContext_ } from "./_generated/server";
import type { Doc as Document__ } from "./_generated/dataModel";
import type { MutationContext, QueryContext, Document_, Table } from "../../stockmarket-shared/src/engine/model";
import { GameError } from "../../stockmarket-shared/src/engine/library";
import { enqueueNextNpcIfNeeded } from "./npc/scheduling";
import { internal } from "./_generated/api";
import { actionAnimationMs } from "../shared/presentation";

// Checked in both directions: persistence cannot silently diverge from engine documents.
type Assert<T extends true> = T;
export type EngineSchemaMatches = Assert<{
    [T in Table]: Document__<T> extends Document_<T> ? Document_<T> extends Document__<T> ? true : false : false;
}[Table] extends true ? true : false>;

export type Arguments<F extends (...arguments_: never[]) => unknown> = Parameters<F> extends [unknown, ...infer Rest]
    ? Rest : never;

export function readEngine(context: QueryContext_): QueryContext
{
    // The store port deliberately exposes fewer query operations than Convex.
    return { db: context.db as unknown as QueryContext["db"] };
}

export async function runEngine<T>(context: MutationContext_,
    operation: (engine: MutationContext) => Promise<T>): Promise<T>
{
    const engine: MutationContext = {
        ...readEngine(context),
        random: () => Math.random(),
        effects: {
            enqueueNextNpc: (gameId) => enqueueNextNpcIfNeeded(context, gameId),
            npcRightsLater: async (command) =>
            {
                const delay = actionAnimationMs + Math.round(800 + Math.random() * 1000);

                await context.scheduler.runAfter(delay, internal.npc.rightsIssue.run, command);
            },
            npcSuspensionLater: async (command) =>
            {
                await context.scheduler.runAfter(actionAnimationMs, internal.npc.suspensions.run, command);
            },
            finishRightsLater: async (command) =>
            {
                await context.scheduler.runAfter(actionAnimationMs, internal.rightsIssue.finish, command);
            },
        },
    };

    try
    {
        return await operation(engine);
    }
    catch (error)
    {
        if (error instanceof GameError)
        {
            throw new ConvexError(error.message);
        }

        throw error;
    }
}
