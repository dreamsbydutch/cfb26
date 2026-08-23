# Team-level historical data

[Reference index](README.md) · [Wiki home](../README.md)

## Current development contract

**Current:** Convex development synchronizes three public OpenSheet feeds into typed, indexed national football tables. Production has not been promoted to this contract. The source workbook remains the upstream authority; synchronization is an idempotent upsert and does not delete records that disappear upstream.

| Feed                | Accepted rows | Coverage  | Convex table            | Grain                  |
| ------------------- | ------------: | --------- | ----------------------- | ---------------------- |
| `RecruitingInput`   |         5,025 | 2001–2025 | `teamRecruitingClasses` | One source ranking row |
| `Standings`         |         3,122 | 2001–2025 | `teamSeasonStandings`   | One program season     |
| `DraftHistoryInput` |         1,024 | 2001–2004 | `teamDraftSelections`   | One NFL draft pick     |

The draft endpoint currently emits another 5,534 rows whose year and primary fields are `#N/A`. Synchronization rejects those rows and records the count in `teamDataSyncState`; it does not convert them to empty selections.

## Program identity

Every fact points to `programs` through `programId` and retains the exact upstream name in `sourceProgramName`. `programAliases` records each feed/name pairing, allowing source labels such as `Texas Christian`/`TCU`, `Pittsburgh`/`Pitt`, and `Massachusetts`/`UMass` to resolve to one program without rewriting source evidence.

The initial alias rules cover common abbreviation/full-name variants. New or ambiguous labels receive a deterministic slug and remain reviewable through their alias record. A later alias correction can repoint subsequent upserts; historical source labels remain intact.

## Stored measures

- Recruiting stores rank, commits, average rating, five-/four-/three-star counts, and points.
- Standings stores overall and conference records, SRS/SOS, AP ranks, championship/playoff markers, and every supplied offense/defense per-game field.
- Draft stores selection identity, player/position/NFL team, pick value, and every supplied career outcome field. It is national pick history, distinct from Michigan's player-linked `draftOutcomes` table.

Blank and `-` draft/standings values become absent optional fields. Numeric zero remains zero. Recruiting preserves all 5,025 rows, including 18 team/year collisions (37 rows) in the source; `sourceId` is therefore the recruiting row identity rather than team/year.

## Refresh behavior

`internal.teamData.syncAll` fetches all feeds, validates every accepted value, checks source-key uniqueness, and upserts batches of 50. `convex/crons.ts` runs it daily at 10:17 UTC. Each feed records start/completion timestamps, accepted/rejected counts, and any failure independently.

The action is internal so unauthenticated clients cannot trigger thousands of writes. Public consumers use bounded queries by season, draft year, or program and can read sync health through `teamData.getSyncState`.

## Game history and retention

**Current:** development stores 22,169 compact FBS schedules/results from 2000–2026, 7,318 detailed team-game rows from 2022–2025, and 3,340 season Elo snapshots from 2000–2025. `collegeGames` retains teams, date/week, venue, scores, line scores, completion flags, and source-provided Elo values. `teamGameStats` retains the source's category/value totals for only the latest five season years; 2026 has no completed-game stats yet. `teamSeasonRatings` keeps one latest Elo snapshot per program/season. A completed sync deletes older detailed-stat rows in batches while preserving compact games and ratings used for matchup history, rankings, and weekly importance.

`internal.games.backfill` imports an explicit 2000-or-later range in restartable chunks of at most five seasons and synchronizes its season Elo snapshots. Historical chunks outside the current rolling window skip the detailed-stat endpoint. Detailed stats are requested only for completed weeks because CFBD requires a week/team/conference filter; the daily 11:17 UTC job revisits the latest two completed weeks instead of the full season. Both operations require `CFBD_API_KEY` in the target Convex environment. With no key, the daily action exits without writes. Development's initial backfill completed on 2026-08-23.

The supported source is [CollegeFootballData](https://github.com/CFBD/cfbd-net/blob/main/docs/games.md) rather than an automated Sports Reference scraper. Sports Reference blocks the attempted automated access, and its published [data-use policy](https://www.sports-reference.com/data_use.html) requires permission for products built from scraped data. This keeps the ingestion path on a documented API and leaves room to replace or augment the provider later without changing the public game queries.

## Known limits

- `/games` is **Current** with live development schedules/ratings plus loading, error, and no-data states.
- Syncs do not delete vanished upstream rows. A reviewed reconciliation workflow is required before treating deletion as authoritative.
- Source corrections that change a recruiting `id`, standings team name, or draft year/pick can create a new semantic record rather than replacing the old one.
- Team aliases are a practical initial crosswalk, not a complete NCAA identity registry.
- Production still has the Michigan-only schema and data.
- CFBD currently returns no 2026 Elo snapshot or completed-game team stats; the daily refresh will add them when available.
