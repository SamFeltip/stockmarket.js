import type { FunctionReturnType } from "convex/server";
import type { api } from "../convex/_generated/api";

export type Board = FunctionReturnType<typeof api.board.get>;

export type Stock = Board["stocks"][number];

export type Player = Board["players"][number];

export type Insight = Board["insights"][number];

export type Run = (action: () => Promise<unknown>) => Promise<boolean>;
