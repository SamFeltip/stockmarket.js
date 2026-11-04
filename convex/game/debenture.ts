import * as engine from "../../../stockmarket-shared/src/engine/debenture";
import type { Arguments } from "../engine";
import { readEngine } from "../engine";
import type { QueryCtx as QueryContext } from "../_generated/server";
export function debentureOffers(context: QueryContext, ...arguments_: Arguments<typeof engine.debentureOffers>)
{
    return engine.debentureOffers(readEngine(context), ...arguments_);
}
