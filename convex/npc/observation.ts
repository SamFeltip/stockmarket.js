import * as engine from "../../../stockmarket-shared/src/engine/observation";
import type { Arguments } from "../engine";
import { readEngine } from "../engine";
import type { QueryCtx as QueryContext } from "../_generated/server";
export function buildNpcObservation(context: QueryContext, ...arguments_: Arguments<typeof engine.buildNpcObservation>)
{
    return engine.buildNpcObservation(readEngine(context), ...arguments_);
}
