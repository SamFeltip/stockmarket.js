import * as engine from "../../../stockmarket-shared/src/engine/npcSuspensions";
import type { Arguments } from "../engine";
import { runEngine } from "../engine";
import type { MutationCtx as MutationContext } from "../_generated/server";
export function resolveNpcSuspensions(context: MutationContext,
    ...arguments_: Arguments<typeof engine.resolveNpcSuspensions>)
{
    return runEngine(context, (runtime) => engine.resolveNpcSuspensions(runtime, ...arguments_));
}
