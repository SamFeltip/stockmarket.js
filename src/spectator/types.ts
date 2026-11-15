import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

type SpectatorSnapshot = NonNullable<FunctionReturnType<typeof api.tv.board>>;
export type Board = Omit<SpectatorSnapshot, "game"> & {
    game: Omit<SpectatorSnapshot["game"], "id" | "tradeHistoryStart">;
};
