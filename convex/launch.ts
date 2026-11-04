import { launchGame as launch } from "../../stockmarket-shared/src/engine/launch";
import { runEngine } from "./engine";
import type { MutationCtx as MutationContext } from "./_generated/server";
import type { Doc as Document_ } from "./_generated/dataModel";
export function launchGame(context: MutationContext, game: Document_<"games">)
{
    return runEngine(context, (runtime) => launch(runtime, game, process.env.NPC_DISABLE_NEW_GAMES !== "true"));
}
