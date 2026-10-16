/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as board from "../board.js";
import type * as catalog from "../catalog.js";
import type * as catalogAdmin from "../catalogAdmin.js";
import type * as games from "../games.js";
import type * as http from "../http.js";
import type * as library from "../library.js";
import type * as rounds from "../rounds.js";
import type * as trading from "../trading.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  board: typeof board;
  catalog: typeof catalog;
  catalogAdmin: typeof catalogAdmin;
  games: typeof games;
  http: typeof http;
  library: typeof library;
  rounds: typeof rounds;
  trading: typeof trading;
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
