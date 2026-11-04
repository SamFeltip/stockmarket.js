import * as engine from "../../../stockmarket-shared/src/engine/roleHistory";
import type { Arguments } from "../engine";
import { readEngine } from "../engine";
import type { QueryCtx as QueryContext } from "../_generated/server";
export function restoreDirectorPriority(context: QueryContext,
    ...arguments_: Arguments<typeof engine.restoreDirectorPriority>)
{
    return engine.restoreDirectorPriority(readEngine(context), ...arguments_);
}
