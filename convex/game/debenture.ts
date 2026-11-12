import * as engine from "../../../stockmarket-shared/src/engine/debenture";
import type { Arguments } from "../engine";
import { readEngine } from "../engine";
import type { QueryCtx as QueryContext } from "../_generated/server";
export function debentureClaims(context: QueryContext, ...arguments_: Arguments<typeof engine.debentureClaims>)
{
    return engine.debentureClaims(readEngine(context), ...arguments_);
}
