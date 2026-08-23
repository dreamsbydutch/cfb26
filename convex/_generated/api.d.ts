/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as eligibility from "../eligibility.js";
import type * as games from "../games.js";
import type * as players from "../players.js";
import type * as programIdentity from "../programIdentity.js";
import type * as ratings from "../ratings.js";
import type * as rosters from "../rosters.js";
import type * as seasonalStats from "../seasonalStats.js";
import type * as teamData from "../teamData.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  eligibility: typeof eligibility;
  games: typeof games;
  players: typeof players;
  programIdentity: typeof programIdentity;
  ratings: typeof ratings;
  rosters: typeof rosters;
  seasonalStats: typeof seasonalStats;
  teamData: typeof teamData;
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
