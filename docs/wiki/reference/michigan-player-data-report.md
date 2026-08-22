# Michigan player data interpretation report

[Reference index](README.md) · [Wiki home](../README.md)

## Bottom line

**Current hosted data (verified 2026-08-22):** the Michigan data is best read as a person-centered roster lifecycle ledger, not as a season-by-season statistics database. Its 3,084 documents describe 428 distinct players who entered, left, remain with, or are committed to Michigan across start seasons 2015–2027.

For each player, the model records an original recruiting profile, one Michigan stint, one Michigan career-to-date summary, one arrival event, an optional departure event, and an optional NFL entry outcome. It can support roster-construction, recruiting, retention, transfer, participation, and draft-path analysis. It cannot by itself explain causation, performance by season, injuries, awards, NIL, game context, or production before or after Michigan.

The most important reading rule is to keep five clocks separate:

1. `recruitingSeason` is generally the player's original prospect class.
2. `rosterStints.startSeason` is the Michigan arrival season.
3. `rosterStints.endSeason` is the final Michigan season.
4. A departure `movementEvents.season` is always `endSeason + 1`, so it describes the following exit cycle.
5. `draftOutcomes.year` can occur years after Michigan if a player continued elsewhere.

The report distinguishes exact data mechanics, owner-confirmed football meanings, and the few remaining unresolved fields.

## Evidence and scope

The analysis began with every document in the verified 2026-08-18 development snapshot. Its SHA-256 is `4dfa90949d281e6a20d688defe5c0481e743d7059e25cd4e9e625c3307be3cbf`, identical to the verified post-migration production export recorded in the [production seed record](../operations/convex-production-seed-2026-08-18.md). That archived 3,091-document snapshot remains the audit and recovery source.

On 2026-08-22, the owner confirmed that Jeremiah Beasley never belonged in the dataset. His player, profile, stint, career summary, legacy row, arrival event, and departure event were removed atomically from both hosted deployments. Bryce Underwood's redshirt count was then corrected from 1 to 0 in his normalized stint and legacy row, and Owen Wafle's 2024 recruit rank was corrected from R26 to R25 in his profile, arrival event, and legacy row. Direct reads of all eight tables after those corrections confirmed that development and production are identical at 3,084 documents with no remaining reference to Beasley's player ID.

The normalized player documents were created in 22 migration batches over 12.75 seconds on 2026-07-27. Every `players.sourceUpdatedAt` equals that player's migration time, so it is an import timestamp in this snapshot, not evidence that the football source was refreshed then.

| Table                    | Documents | Grain and safe interpretation                                                      |
| ------------------------ | --------: | ---------------------------------------------------------------------------------- |
| `players`                |       428 | One canonical identity and high-school origin per person                           |
| `recruitingProfiles`     |       428 | One original recruiting profile and Michigan acquisition classification per player |
| `rosterStints`           |       428 | One Michigan stint and snapshot roster state per player                            |
| `programCareerSummaries` |       428 | One Michigan cumulative participation/rating summary per player                    |
| `movementEvents`         |       720 | One arrival for every player plus one departure for each departed player           |
| `draftOutcomes`          |       109 | One concrete drafted or UDFA outcome for a subset of players                       |
| `programs`               |       115 | Michigan plus every represented transfer origin/destination label                  |
| `legacyPlayerRows`       |       428 | The original string-heavy source rows retained for migration audit                 |

The 428 live legacy rows are not additional players. They duplicate the source facts that were parsed into the normalized tables. The original migration successfully processed 429 rows under migration version 1; the one invalid Beasley source row was later removed with its normalized lifecycle.

## Owner-confirmed domain definitions

**Current domain definitions (confirmed 2026-08-22):**

- The 2026 `active` rows are the current roster; the 2027 `committed` rows are a partial future commitment class.
- `endSeason` is the final Michigan season, and a departure event in the following year represents that exit cycle.
- R#/T#/W# ranks maintain separate ordered lists for recruits, transfers, and walk-ons. They are not national recruiting-quality ranks.
- `departureClass` and `departureRank` are current-offseason display helpers for players whose final Michigan season was the immediately preceding season. `T`, `G`, and `U` mean transferred, graduated, and UDFA; drafted players are grouped through `draftOutcomes`.
- `eligibilityLeaveSeason` is the first season a player is eligible to leave for the NFL: `recruitingSeason + 2`, or three years removed from high school.
- `depthChartOrder` is position-local, lower values are better, and the field is intended only for players currently on the roster.
- Recruiting ratings on transfer records are their original high-school evaluations, not transfer-portal grades.
- Blank strings and dashes have the same meaning: no source data. Dashes are used most often for absent recruiting data.
- A UDFA `team` is the player's first signing team.
- Exact position labels should be preserved; analyses should map them into broader position categories without replacing the source value.
- `recentRating`, sourced from `RecentMichiganRtg`, was entered manually from the PFF website. A value of zero means the field had not been updated at that point; the rated season is not stored.
- `redshirtSeasons` counts extra seasons of eligibility granted beyond the standard four. It is not necessarily a literal count of conventional redshirt seasons.
- Obvious aliases and minor spelling errors may be corrected in place; the corrected model does not need to preserve those erroneous values.
- Michigan NFL success includes only players who went directly from Michigan to a drafted or UDFA outcome. Later outcomes after another school are eventual player outcomes, not Michigan-to-NFL successes.
- A dismissal is the Michigan exit. If the player later joins another school, that is a separate post-Michigan move rather than part of the dismissal event.
- Transfer and walk-on data is maintained annually, but that process did not begin until 2018. Earlier zeroes are a coverage boundary, not evidence that Michigan had no such players.
- `proGamesPlayed` and `proCareerValue` came from an abandoned idea and were never implemented.

**Current data defect:** `depthChartOrder` is populated on all 16 future commitments even though that field is intended only for the current roster. Ignore those committed-player values.

**Undecided:** whether the 16 committed-player depth values should be cleared from the hosted data.

## Relationship model

```text
players (428)
|-- 1 recruitingProfiles       original prospect data + Michigan entry type
|-- 1 rosterStints             Michigan tenure + snapshot status
|-- 1 programCareerSummaries   Michigan cumulative games/snaps/rating
|-- 1..2 movementEvents        exactly one arrival; optional departure
`-- 0..1 draftOutcomes         only a drafted or UDFA result

programs (115)
|-- Michigan is the subject of every stint, event, and career summary
`-- fromProgramId/toProgramId identify represented transfer endpoints
```

Use `playerId` for durable joins and `programId` for program joins. Every foreign key resolves, and every observed key candidate that should identify one record is unique in this snapshot. `legacyKey` is a readable migration identity built from normalized name, recruiting year, and high school; it happens to be unique but is vulnerable to source corrections. `movementEvents.sourceKey` is the player legacy key plus `:arrival` or `:departure` and is unique across all events.

## How to read a player lifecycle

### Recruiting and arrival

`recruitingProfiles.source` means the route by which the player entered Michigan, not the provenance of the rating data:

| Source        | Players | Arrival event kind | Raw code |
| ------------- | ------: | ------------------ | -------- |
| `high_school` |     297 | `recruited`        | `R`      |
| `transfer`    |      61 | `transfer_in`      | `T`      |
| `walk_on`     |      70 | `walk_on`          | `W`      |

Every player has exactly one arrival event, and its event season equals the Michigan `startSeason`. `recruitingSeason` instead follows the original prospect profile: 74 players arrive in a different year, including 59 transfers, 12 walk-ons, two reclassified high-school players, and Andrew Gentry's two-year gap.

`classRank` is exactly the numeric suffix of the source R#/T#/W# value and is copied to the arrival event's `cohortRank`. Within every Michigan arrival season and acquisition type, it forms a complete `1..N` sequence. Its purpose is to keep separate category-local rankings for recruits, transfers, and walk-ons. It is not a national talent rank and should not be compared across acquisition types or seasons. After Beasley's removal, moving Owen Wafle from R26 to R25 restored the 2024 high-school sequence to R1–R25.

Recruiting position, height, and weight are recruit-time attributes. They should not be substituted for the roster position or later Michigan measurements.

### Michigan stint and status

`rosterStints.status` divides the snapshot into:

- 292 `departed` players, each with `endSeason` and one departure event.
- 120 `active` players, each without an end or departure event.
- 16 `committed` players, all with a 2027 start season and no end or departure event.

All 428 stints and all 428 career summaries point to Michigan. Treat the 120 `active` rows as the current 2026 roster and the 16 `committed` rows as a separate, partial 2027 class.

The roster position is the player's current or final Michigan label, while recruiting position is the earlier prospect label. The taxonomies also changed over time: older rows use labels such as `PRO`, `SDE`, `WDE`, `ILB`, `OLB`, `LT`, `RT`, `LG`, and `RG`; newer rows favor `QB`, `EDGE`, `LB`, `OT`, and `OG`. Preserve those exact values for source fidelity and use a separate, football-approved category map for longitudinal analysis.

`depthChartOrder` is a lower-is-better, position-local order intended only for the current roster. It is present and contiguous from 1 within each active position. The snapshot also populates it on all 16 committed players, where values jump to later slots—usually 11/12 on offense or 14–16 on defense. Those committed values conflict with the intended field scope and should not be interpreted as a current depth chart.

The eligibility fields behave like a modeled eligibility clock rather than actual Michigan tenure:

- `eligibilityStartSeason` equals the original recruiting year for 425 of 428 players; two reclassified players start earlier and Andrew Gentry starts two years later.
- `eligibilityLeaveSeason` equals `recruitingSeason + 2` for all 428 players.
- `eligibilityEndSeason` equals `eligibilityStartSeason + 3 + redshirtSeasons` for all 428 players.
- No actual Michigan `endSeason` exceeds `eligibilityEndSeason`.

`eligibilityLeaveSeason` is confirmed as the first NFL-eligible season: three years removed from high school, represented as `recruitingSeason + 2`. `redshirtSeasons` is the number of extra eligibility seasons granted beyond the standard four, which explains the end-season formula. Bryce Underwood is correctly recorded with zero redshirt seasons and a 2028 eligibility end.

### Departure

Every departed player has exactly one departure event, and every departure event occurs in `endSeason + 1`:

| Departure kind | Players | Share of departures | Raw code |
| -------------- | ------: | ------------------: | -------- |
| `transfer_out` |     141 |               48.3% | `T`/`t`  |
| `graduated`    |     140 |               47.9% | `G`      |
| `retired`      |       7 |                2.4% | `R`      |
| `dismissed`    |       4 |                1.4% | `D`      |

The `legacyCode` alone is unsafe because `R` means either recruited or retired and `T` means either transfer in or transfer out. Use `kind` plus event direction.

The 2026 offseason view covers 47 players whose final Michigan season was 2025. Six drafted players are identified directly through their draft outcomes and have no departure helper rank. The other 41 use `departureClass` and `departureRank`: T1–T24 are transfers, U1–U4 are UDFAs, and G1–G13 are graduates. These are current-offseason presentation ranks, not historical or talent rankings. A U-ranked player may still have a `graduated` movement event because the event describes how the Michigan stint ended while `U` describes the player's NFL-entry display group.

### Michigan participation and rating

`programCareerSummaries` contains cumulative Michigan-level values, not one row per season:

| Field            |        Coverage | Distribution                         | Safe reading                                         |
| ---------------- | --------------: | ------------------------------------ | ---------------------------------------------------- |
| `gamesPlayed`    |         428/428 | 0–62; median 5                       | Michigan cumulative games in the current hosted data |
| `snaps`          |         428/428 | 0–3,219; median 35.5                 | Michigan cumulative snaps in the current hosted data |
| `recentRating`   | 282/428 updated | 25.7–94.5; median 64.35 when updated | Manually entered PFF rating; rated season not stored |
| `proGamesPlayed` |           0/428 | No values                            | Abandoned, never-implemented placeholder             |
| `proCareerValue` |           0/428 | No values                            | Abandoned, never-implemented placeholder             |

Games and snaps are internally coherent: the same 128 players have zero for both, and no row has games without snaps or snaps without games. `RecentMichiganRtg`, normalized as `recentRating`, was manually entered from the PFF website. It is zero for 146 players, including 18 with positive games and snaps; zero means the field had not been updated at that point and is a missing-data sentinel, not a performance grade. The dataset does not store which PFF season was used. If displayed, label nonzero values as "manually entered PFF rating (season unspecified)" and never include zeroes in rating analysis.

No committed player had the PFF field updated, and many active/recent cohorts are right-censored. Comparing raw career totals across entry cohorts without tenure adjustment will favor older, completed careers.

### NFL entry outcome

`draftOutcomes` records only concrete positive entry paths:

- 67 drafted players, all with round and overall pick.
- 42 undrafted free agents, all with a team and without round/pick.
- 319 players with no normalized outcome row.

Absence is not a safe negative outcome. In the legacy rows, 63 players have dashes in all four draft fields, 255 have all four fields blank, and one row has only a dash in `DraftTeam`. The owner confirms that blank and dash both mean no data, so normalization correctly treats all of them as absent. Context is still required to distinguish not yet eligible, no known outcome, and an outcome that has not been entered.

Of the 109 recorded outcomes, 88 are direct Michigan-to-NFL outcomes: 58 drafted players and 30 UDFAs. The other 21 outcomes—9 drafted and 12 UDFAs—occurred two to five years after the player's final Michigan season and do not count as Michigan NFL success. Eighteen followed a Michigan transfer-out; the other three followed two graduated and one dismissed Michigan departures. A safe derived rule is `year == endSeason + 1` with no `transfer_out` departure. Preserve the other outcomes as eventual player history, not Michigan development credit.

`team` is the drafting team for drafted players and the first signing team for UDFAs.

## Current hosted baselines

### Michigan intake by start season

This table uses Michigan `startSeason`, not original `recruitingSeason`.

|     Start | High school | Transfer | Walk-on |   Total | Departed |  Active | Committed |
| --------: | ----------: | -------: | ------: | ------: | -------: | ------: | --------: |
|      2015 |          14 |        0 |       0 |      14 |       14 |       0 |         0 |
|      2016 |          27 |        0 |       0 |      27 |       27 |       0 |         0 |
|      2017 |          30 |        0 |       0 |      30 |       30 |       0 |         0 |
|      2018 |          20 |        0 |       1 |      21 |       21 |       0 |         0 |
|      2019 |          26 |        2 |       6 |      34 |       34 |       0 |         0 |
|      2020 |          22 |        1 |       9 |      32 |       32 |       0 |         0 |
|      2021 |          22 |        3 |      12 |      37 |       36 |       1 |         0 |
|      2022 |          23 |        3 |      16 |      42 |       33 |       9 |         0 |
|      2023 |          25 |        9 |      11 |      45 |       31 |      14 |         0 |
|      2024 |          25 |        9 |       6 |      40 |       17 |      23 |         0 |
|      2025 |          26 |       18 |       1 |      45 |       17 |      28 |         0 |
|      2026 |          21 |       16 |       8 |      45 |        0 |      45 |         0 |
|      2027 |          16 |        0 |       0 |      16 |        0 |       0 |        16 |
| **Total** |     **297** |   **61** |  **70** | **428** |  **292** | **120** |    **16** |

Transfer and walk-on tracking is updated annually but did not begin until 2018. The pre-2018 zeroes are incomplete historical coverage and must not be interpreted as a Michigan roster-building trend.

### Recruiting coverage

| Recruiting field group            |      Present | Interpretation caution                       |
| --------------------------------- | -----------: | -------------------------------------------- |
| Position                          |      427/428 | Original recruit taxonomy; one omitted value |
| Height and weight                 | 426/428 each | Recruit-time measurements                    |
| Composite rating/rank quartet     |      339/428 | All-or-none; coverage is source-dependent    |
| `service247` rating               |      341/428 | 70–100 scale in observed data                |
| `service247` position/state ranks | 340/428 each | Lower values indicate stronger observed rank |
| `service247` overall rank         |      116/428 | Values stop at 240; appears top-list-limited |

Missing recruiting data is highly structured: high-school recruits have 295 of 297 composite/`service247` ratings; transfers have 43 composite and 46 `service247` ratings out of 61; walk-ons have one composite rating and no `service247` ratings. Missing values must not be imputed as zero or worst-in-class.

Composite ratings use an observed 0.7594–1.0 scale; `service247` ratings use 70–100. Their rank fields are lower-is-better within a recruiting cohort. Do not average raw ranks across differently sized cohorts without normalization.

### Geography and current position

Every player has hometown, high school, and `homeState`. The largest home-state counts are Michigan 87, Florida 39, Ohio 31, California 25, Texas 25, Georgia 21, Illinois 19, New Jersey 16, Connecticut 15, and Maryland 15. The field is not US-state-only: it also contains `QC`, `AUS`, `FRAN`, and `GERM`, mixing a province and country-like codes.

The 120 active players span 17 roster labels: LB 13, EDGE 12, CB 11, S 11, DL 10, OG 9, WR 9, OT 8, RB 8, QB 6, SLOT 5, TE 5, LS 3, OC 3, P 3, FB 2, and K 2. The 16 committed players should remain separate from this snapshot roster unless a future-depth view is intended.

### Direct and eventual NFL entry outcomes by year

|      Year | Direct drafted | Direct UDFA | Direct total | All outcome rows |
| --------: | -------------: | ----------: | -----------: | ---------------: |
|      2019 |              4 |           2 |            6 |                6 |
|      2020 |              9 |           2 |           11 |               13 |
|      2021 |              5 |           3 |            8 |               14 |
|      2022 |              5 |           6 |           11 |               14 |
|      2023 |              9 |           2 |           11 |               14 |
|      2024 |             13 |           7 |           20 |               24 |
|      2025 |              7 |           4 |           11 |               14 |
|      2026 |              6 |           4 |           10 |               10 |
| **Total** |         **58** |      **30** |       **88** |          **109** |

The direct columns are the Michigan-success view. The final column is the complete positive-outcome inventory, including 21 outcomes after another stop or a later path. Neither is a draft conversion rate because absence is not a confirmed negative result.

## Analysis recipes and traps

| Question                           | Recommended interpretation                                                                                  | Main trap                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Who is on the snapshot roster?     | Filter `rosterStints.status == active`; ignore depth values on commitments                                  | Combining 2027 commitments with active players            |
| Who entered in a Michigan class?   | Group `startSeason` plus recruiting `source`                                                                | Grouping transfers by original `recruitingSeason`         |
| How strong was a recruiting class? | Use ratings/top-end counts only among rated high-school recruits; report coverage                           | Treating `classRank` as talent or missing ratings as zero |
| Who stayed or left?                | Follow arrival → stint → departure; compare only sufficiently mature cohorts                                | Calling active/right-censored players retained outcomes   |
| Which season had exits?            | Use `endSeason` for final Michigan season or label event season as the following exit cycle                 | Treating a 2026 exit event as 2026 Michigan participation |
| Who produced at Michigan?          | Use games/snaps; use only nonzero `recentRating` as a manually entered PFF value with an unspecified season | Treating zero as a rating or comparing unequal tenure     |
| Did recruiting position change?    | Preserve exact labels and join through a separate, reviewed position-category map                           | Treating taxonomy drift as a true position conversion     |
| Where did transfers come from/go?  | Follow `fromProgramId`/`toProgramId` after approved alias and spelling cleanup                              | Counting CMU/Central Michigan and misspellings separately |
| Who reached the NFL from Michigan? | Require a next-year outcome and no transfer-out; retain later outcomes only as eventual history             | Crediting an outcome reached after another school         |

Correlations between recruiting measures and later production should be stratified by entry source, position family, start cohort, and available tenure. Transfers carry development from prior programs, walk-ons have systematically missing recruiting ratings, and active/future players have incomplete Michigan careers. An unadjusted all-player correlation would combine incompatible populations.

## Known defects and legacy limitations

- Jeremiah Beasley's invalid lifecycle was corrected on 2026-08-22 by removing its seven linked documents from both deployments. The archived pre-correction snapshot remains the recovery and audit source.
- Nico Crawford is a `transfer_in` with no prior-program value.
- Christian Boivin and Anthony Simpson are transfers out with unknown destinations.
- Dominic Zvada and Anthony Arnou are classified as walk-ons despite prior-program links, so acquisition type takes precedence over transfer origin in those rows.
- Nate Johnson was dismissed and later joined a JUCO, O'Maury Samuels was dismissed and later joined NMSU, and Brian Cole was dismissed and later joined Mississippi State. Those are separate post-Michigan moves, not destinations attached to the dismissal itself. The legacy rows retain the destinations, but the normalized model lacks a dated subsequent event; do not invent an event date or attach `toProgramId` to the dismissal.
- `CMU` and `Central Michigan` are separate programs; `Costal Carolina` and `Lousiana` are misspelled. The owner permits merging/correcting those minor errors in place. `N/A` and `JUCO` are categories rather than spelling mistakes and need explicit category treatment.
- Current height/weight are complete for active and committed players but present for only 156 of 292 departed players. Historical body-size comparisons have status/era-biased missingness.
- Jersey number is present for 264 players, including 110 active players, and absent for every committed player.
- Bryce Underwood's `redshirtSeasons` value was corrected from 1 to 0, and Owen Wafle's 2024 recruit rank was corrected from R26 to R25 in both normalized and legacy data.
- Blank and dash are equivalent missing-data sentinels; no semantic distinction needs to be preserved during normalization.
- All pro-career fields are empty remnants of an abandoned feature idea, so the dataset currently stops at NFL entry.

## Remaining cleanup decision

The field meanings needed to interpret this dataset are now resolved. One cleanup choice remains: should the 16 `depthChartOrder` values on committed players be cleared from both hosted deployments? Until that is answered, exclude those values from every current-depth view.
