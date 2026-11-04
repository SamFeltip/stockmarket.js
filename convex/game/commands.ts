import * as engine from "../../../stockmarket-shared/src/engine/commands";
import type { Arguments } from "../engine";
import { runEngine } from "../engine";
import type { MutationCtx as MutationContext } from "../_generated/server";
export function applyTurn(context: MutationContext, ...arguments_: Arguments<typeof engine.applyTurn>)
{
    return runEngine(context, (runtime) => engine.applyTurn(runtime, ...arguments_));
}

export function finishTurn(context: MutationContext, ...arguments_: Arguments<typeof engine.finishTurn>)
{
    return runEngine(context, (runtime) => engine.finishTurn(runtime, ...arguments_));
}
