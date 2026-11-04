import { ConvexError } from "convex/values";
import * as engine from "../../stockmarket-shared/src/engine/suspensions";
import type { Arguments } from "./engine";
import { runEngine } from "./engine";
import type { MutationCtx as MutationContext } from "./_generated/server";
export function spendSuspension(context: MutationContext, ...arguments_: Arguments<typeof engine.spendSuspension>)
{
    return runEngine(context, (runtime) => engine.spendSuspension(runtime, ...arguments_));
}

export function checkSuspensionPhase(...arguments_: Parameters<typeof engine.checkSuspensionPhase>)
{
    try
    {
        return engine.checkSuspensionPhase(...arguments_);
    }
    catch (error)
    {
        if (error instanceof Error)
        {
            throw new ConvexError(error.message);
        }

        throw error;
    }
}
