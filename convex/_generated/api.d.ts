/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cfbdAudit from "../cfbdAudit.js";
import type * as cfbdClient from "../cfbdClient.js";
import type * as cfbdHealth from "../cfbdHealth.js";
import type * as cfbdHealthProbe from "../cfbdHealthProbe.js";
import type * as crons from "../crons.js";
import type * as eligibility from "../eligibility.js";
import type * as games from "../games.js";
import type * as migrationV2 from "../migrationV2.js";
import type * as migrations from "../migrations.js";
import type * as nflverse from "../nflverse.js";
import type * as playerDomain from "../playerDomain.js";
import type * as players from "../players.js";
import type * as powerResearch from "../powerResearch.js";
import type * as programIdentity from "../programIdentity.js";
import type * as programRating from "../programRating.js";
import type * as rankingTools from "../rankingTools.js";
import type * as ratingBacktest from "../ratingBacktest.js";
import type * as ratingFallback from "../ratingFallback.js";
import type * as ratingFields from "../ratingFields.js";
import type * as ratingInputs from "../ratingInputs.js";
import type * as ratingModel from "../ratingModel.js";
import type * as ratingSystem from "../ratingSystem.js";
import type * as ratings from "../ratings.js";
import type * as rosterAdmin from "../rosterAdmin.js";
import type * as rosters from "../rosters.js";
import type * as seasonalStats from "../seasonalStats.js";
import type * as teamData from "../teamData.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  cfbdAudit: typeof cfbdAudit;
  cfbdClient: typeof cfbdClient;
  cfbdHealth: typeof cfbdHealth;
  cfbdHealthProbe: typeof cfbdHealthProbe;
  crons: typeof crons;
  eligibility: typeof eligibility;
  games: typeof games;
  migrationV2: typeof migrationV2;
  migrations: typeof migrations;
  nflverse: typeof nflverse;
  playerDomain: typeof playerDomain;
  players: typeof players;
  powerResearch: typeof powerResearch;
  programIdentity: typeof programIdentity;
  programRating: typeof programRating;
  rankingTools: typeof rankingTools;
  ratingBacktest: typeof ratingBacktest;
  ratingFallback: typeof ratingFallback;
  ratingFields: typeof ratingFields;
  ratingInputs: typeof ratingInputs;
  ratingModel: typeof ratingModel;
  ratingSystem: typeof ratingSystem;
  ratings: typeof ratings;
  rosterAdmin: typeof rosterAdmin;
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

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
