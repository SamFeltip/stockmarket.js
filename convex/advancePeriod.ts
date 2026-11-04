import * as engine from "../../stockmarket-shared/src/engine/advancePeriod";
import type { Arguments } from "./engine";
import { runEngine } from "./engine";
import type { MutationCtx as MutationContext } from "./_generated/server";
export function advancePeriod(context: MutationContext, ...arguments_: Arguments<typeof engine.advancePeriod>)
{
    return runEngine(context, (runtime) => engine.advancePeriod(runtime, ...arguments_));
}
