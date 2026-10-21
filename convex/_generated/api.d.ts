/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as advancePeriod from "../advancePeriod.js";
import type * as auth from "../auth.js";
import type * as board from "../board.js";
import type * as catalog from "../catalog.js";
import type * as catalogAdmin from "../catalogAdmin.js";
import type * as crons from "../crons.js";
import type * as game_commands from "../game/commands.js";
import type * as game_legalActions from "../game/legalActions.js";
import type * as game_seats from "../game/seats.js";
import type * as games from "../games.js";
import type * as http from "../http.js";
import type * as launch from "../launch.js";
import type * as library from "../library.js";
import type * as migrations from "../migrations.js";
import type * as npc_identity from "../npc/identity.js";
import type * as npc_lobby from "../npc/lobby.js";
import type * as npc_observation from "../npc/observation.js";
import type * as npc_persistence from "../npc/persistence.js";
import type * as npc_recovery from "../npc/recovery.js";
import type * as npc_scheduling from "../npc/scheduling.js";
import type * as npc_worker from "../npc/worker.js";
import type * as rounds from "../rounds.js";
import type * as trading from "../trading.js";
import type * as tv from "../tv.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  advancePeriod: typeof advancePeriod;
  auth: typeof auth;
  board: typeof board;
  catalog: typeof catalog;
  catalogAdmin: typeof catalogAdmin;
  crons: typeof crons;
  "game/commands": typeof game_commands;
  "game/legalActions": typeof game_legalActions;
  "game/seats": typeof game_seats;
  games: typeof games;
  http: typeof http;
  launch: typeof launch;
  library: typeof library;
  migrations: typeof migrations;
  "npc/identity": typeof npc_identity;
  "npc/lobby": typeof npc_lobby;
  "npc/observation": typeof npc_observation;
  "npc/persistence": typeof npc_persistence;
  "npc/recovery": typeof npc_recovery;
  "npc/scheduling": typeof npc_scheduling;
  "npc/worker": typeof npc_worker;
  rounds: typeof rounds;
  trading: typeof trading;
  tv: typeof tv;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
