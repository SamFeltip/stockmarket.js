import { advanceNpcRights as advance } from "../../../stockmarket-shared/src/engine/npcRights";
import { runEngine } from "../engine";
import type { MutationCtx as MutationContext } from "../_generated/server";
import type { Doc as Document_ } from "../_generated/dataModel";
export function advanceNpcRights(context: MutationContext, game: Document_<"games">,
    purchase: (context: MutationContext, game: Document_<"games">, quantity: number) => Promise<Document_<"games">>)
{
    return runEngine(context, (runtime) => advance(runtime, game,
        (_runtime, current, quantity) => purchase(context, current, quantity)));
}
