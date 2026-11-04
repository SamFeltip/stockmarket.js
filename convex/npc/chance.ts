import * as engine from "../../../stockmarket-shared/src/engine/chanceOffers";
import type { Arguments } from "../engine";
import { readEngine } from "../engine";
import type { QueryCtx as QueryContext } from "../_generated/server";
export function chanceOffers(context: QueryContext, ...arguments_: Arguments<typeof engine.chanceOffers>)
{
    return engine.chanceOffers(readEngine(context), ...arguments_);
}
