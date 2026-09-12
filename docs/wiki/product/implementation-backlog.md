# CFB26 implementation backlog

[Product index](README.md) · [System definition](system-definition.md) · [Wiki home](../README.md)

## Backlog contract

**Current source — implemented 2026-09-06; hosted backend cutover 2026-09-07:** This is the delivery record for the [CFB26 system definition](system-definition.md). All nine phases are represented in the checked-in source contract and local verification suite. The backed-up development cutover, production promotion, count reconciliation, and representative backend smoke checks are complete. No web release was included.

The acceptance tables retain the contract that shaped implementation. “Implemented” means the source, UI workflow, validation, and offline tests exist. Hosted migration evidence is recorded separately from source implementation and web delivery.

Every phase must:

1. define its data invariants and destructive/retry behavior before mutating hosted data;
2. add proportional automated coverage at pure validation and transactional seams;
3. preserve bounded/indexed reads and explicit null semantics;
4. update the owning wiki pages and generated contracts through their generators;
5. pass `npm run check`; and
6. receive an authorized development deployment validation before any production promotion.

Material import, merge, delete, rollover, and migration work additionally requires a verified Michigan export and restore path before execution. Production deployment remains a separately authorized operation.

## Phase map

| Phase | Outcome                                     | Source status                                        |
| ----: | ------------------------------------------- | ---------------------------------------------------- |
|     1 | New schema and controlled migration         | Implemented; hosted cutover complete                 |
|     2 | Unified CFBD team/game layer                | Implemented                                          |
|     3 | Complete Michigan roster administration     | Implemented                                          |
|     4 | Michigan player-game tracking and grades    | Implemented                                          |
|     5 | Predictive ratings and frozen forecasts     | Implemented                                          |
|     6 | Résumé, schedule, playoff, and ballot tools | Implemented                                          |
|     7 | Draft and Michigan-alumni NFL tracking      | Implemented                                          |
|     8 | Operational hardening                       | Implemented; cutover verified, restore drill pending |
|     9 | Final UI redesign                           | Implemented in source; deployment pending            |

## Phase 1 — Schema and controlled migration

**Goal:** Replace the legacy flat Michigan/PFF/OpenSheet boundaries with the approved identity, Player Season, evaluation, source-health, and immutable-output foundations without losing valid Michigan lifecycle or draft data.

| ID   | Work package                | Acceptance evidence                                                                                                                                                                                                                        |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1.1 | Export and audit            | Versioned, restorable Michigan export; counts and identity keys recorded; secrets and transient payloads excluded.                                                                                                                         |
| P1.2 | Define target schema        | Validators, tables, indexes, null semantics, uniqueness rules, data-quality states, and retention ownership cover Person, commitment/enrollment, Michigan stint, Player Season, Evaluation Event, provider identity, and unresolved match. |
| P1.3 | Build migration dry run     | Deterministic report maps legacy people/lifecycle/draft facts, shows every rejected or ambiguous record, and performs no writes.                                                                                                           |
| P1.4 | Migrate roster tenure       | Existing roster stints become season-specific Player Seasons while preserving distinct Michigan stints and valid departures/draft outcomes.                                                                                                |
| P1.5 | Remove PFF                  | Backed-up migration deletes PFF grades and associated snap data; source/UI/query fields, `SnapCounts.json`, and PFF-specific preparation/import code are removed rather than relabeled.                                                    |
| P1.6 | Replace OpenSheet ingestion | CFBD-backed source contracts replace OpenSheet dependencies while retaining source evidence and last-valid-data behavior.                                                                                                                  |
| P1.7 | Resolve identities safely   | Exact matches link automatically; ambiguous provider identities remain in a reviewable unresolved queue; no heuristic match silently becomes canonical.                                                                                    |
| P1.8 | Cut over and reconcile      | Development validates schema/functions, migrated counts reconcile to the audit, restore is exercised, and obsolete legacy paths are no longer reachable.                                                                                   |

**Exit condition:** development runs the new schema with all preserved records reconciled or explicitly queued; PFF/OpenSheet code and data are absent; a verified export can restore the Michigan domain.

## Phase 2 — Unified CFBD team and game layer

**Goal:** Give every national feature one authoritative, historical, leakage-safe program/game foundation.

| ID   | Work package        | Acceptance evidence                                                                                                                    |
| ---- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| P2.1 | Program identity    | Programs, aliases, provider IDs, subdivision state, and non-guessing conflict handling support seasonal identity.                      |
| P2.2 | Historical context  | Season-specific affiliations and venues render without rewriting history when names or conferences change.                             |
| P2.3 | Compact games       | Complete 2000-forward schedules/results retain stable source keys, venue, status, score, and correction-safe upserts.                  |
| P2.4 | Detailed features   | Bounded five-year team-game feature storage covers only approved model/rendering inputs and prunes safely.                             |
| P2.5 | Source health/cache | Required and optional endpoints have explicit freshness, last-success, failure, and cache behavior; empty failures preserve good data. |
| P2.6 | Read contracts      | Bounded season, team, game, head-to-head, venue, and synchronization queries serve later phases without raw-provider coupling.         |
| P2.7 | Public team slice   | Program profiles expose schedules, historical affiliations/venues, recruiting/talent context, ratings, and draft production.           |

**Exit condition:** team and game reads cover the required historical ranges, identities are auditable, and required-source failure cannot erase the last valid snapshot.

## Phase 3 — Michigan roster administration

**Goal:** Make the owner able to record the complete Michigan lifecycle and produce reliable season rosters from 2015 onward.

| ID    | Work package               | Acceptance evidence                                                                                                                                                      |
| ----- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P3.1  | Prospect lifecycle         | Commitments, decommitments, enrollment, transfer entry, walk-on entry, and minimum-create validation preserve prospect/enrolled separation.                              |
| P3.2  | Player Seasons             | Owner manages listed position, room, measurements, scholarship, roster/depth/role/order, games/starts, availability, distinctions, sources, and quality state by season. |
| P3.3  | Eligibility                | Season rule sets derive eligibility from retained evidence, expose reasoning, and support visible `eligibleThroughSeason` overrides.                                     |
| P3.4  | Roster limits              | Season-specific counted/exempt/unknown totals and warnings never block truthful entry.                                                                                   |
| P3.5  | Departures/stints          | Departures close the correct stint; a returning player creates another stint under the same Person.                                                                      |
| P3.6  | Evaluations                | Recruiting, inbound/outbound transfer, and draft evaluations are repeatable events with provider, date, scale, score, ranking, and direction.                            |
| P3.7  | Lifecycle bulk entry       | CSV/JSON roster and lifecycle imports produce a no-write dry run with exact matches, proposed changes, errors, and unresolved identities.                                |
| P3.8  | Rollover                   | Preview shows creates/carries/exits/warnings before one transactional season rollover.                                                                                   |
| P3.9  | Health and recovery        | Duplicate, missing-season, invalid-order, eligibility, and unresolved-identity queues are actionable; backup precedes material changes.                                  |
| P3.10 | Identity repair            | Previewed duplicate merges update all dependents transactionally; scoped deletion removes records created erroneously; both require a verified backup.                   |
| P3.11 | Public roster intelligence | Season rosters, four-player comparisons, position rooms, scholarships, eligibility, roster limits, development, and returning production use the Player Season contract. |

**Exit condition:** the owner can construct, roll, audit, export, and restore every Michigan season roster from 2015 onward without editing raw documents.

## Phase 4 — Michigan player games and grades

**Goal:** Record one optional Player Game per rostered player/game with truthful phase participation and CFB26 grades.

| ID   | Work package         | Acceptance evidence                                                                                                                             |
| ---- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| P4.1 | Player Game contract | Unique person/game record has independent offense, defense, and special-teams snaps/grade fields plus conventional statistics and source state. |
| P4.2 | Validation           | `0` and `null` snaps remain distinct; zero snaps rejects a grade; grade range/precision and roster/game identity are enforced transactionally.  |
| P4.3 | Owner entry          | Game-oriented and player-oriented forms support partial save, ungraded state, keyboard use, and clear unknown coverage.                         |
| P4.4 | Bulk import          | CSV/JSON validation produces a dry run with matches, changes, errors, and unresolved identities; backup is required before apply.               |
| P4.5 | Summaries            | Phase season grades are snap-weighted only over known snaps; unknown-snap grades stay separate; grade bands use the approved labels.            |
| P4.6 | Public integration   | Michigan game pages and player profiles show participation, CFB26 grades, coverage, and separate CFBD statistics.                               |

**Exit condition:** one complete Michigan game can be entered, validated, summarized, exported/restored, and explored publicly without conflating zero, unknown, or ungraded values.

## Phase 5 — Predictive Power and forecasts

**Goal:** Publish leakage-safe Power editions and freeze reproducible prospective matchup forecasts.

| ID   | Work package            | Acceptance evidence                                                                                                                                     |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P5.1 | Baseline reconstruction | The opponent-adjusted points model produces labeled 2015-forward research reconstructions with edition/model/source vintage.                            |
| P5.2 | Priors                  | Approved talent, recent performance, returning production, and transfer priors are versioned, cutoff-safe, and expose remaining influence as they fade. |
| P5.3 | Challenger features     | Compact interpretable candidates are added only behind a model version and without brand/prestige or Michigan-grade leakage.                            |
| P5.4 | Evaluation              | Rolling held-out margin, Brier, and calibration evidence enforces ADR 0007 promotion gates and records rejected challengers as research.                |
| P5.5 | Uncertainty/calibration | Forecast outputs include expected margin, win probability, uncertainty, home field, edition, model, and calibration version.                            |
| P5.6 | Frozen forecasts        | Scheduled forecasts freeze before kickoff and cannot be silently replaced; corrections create traceable amendments.                                     |
| P5.7 | Matchup scenarios       | Scheduled and imaginary matchups use the same baseline; user adjustments remain separate and explicitly labeled.                                        |

**Exit condition:** an official prospective 2026 forecast can be reproduced from its frozen inputs, while reconstructed and research results are unmistakably labeled.

## Phase 6 — Merit and ranking tools

**Goal:** Build all earned-record, schedule, playoff, and owner-ballot features on immutable edition evidence.

| ID   | Work package     | Acceptance evidence                                                                                                                                                                         |
| ---- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P6.1 | Résumé editions  | Entering Week 7 uses 70% results credit and 30% result-bounded performance credit with edition Power as opponent quality and no direct talent/conference bonus.                                      |
| P6.2 | Quadrants/SOS    | Q1–Q4, FCS separation, played/remaining/full strength, splits, average opponent Power, benchmark expected wins, and hardest-game ordering use the selected cutoff only.                     |
| P6.3 | Evidence/ties    | Head-to-head, common opponents, championships, Q1 wins, road/neutral success, and stable tie order display without duplicate score bonuses.                                                 |
| P6.4 | Playoff rules    | Season-specific qualification rules deterministically explain provisional/actual champions, bids, seeds, byes, at-larges, and first team out.                                               |
| P6.5 | Blind ballot     | Every active FBS team is seeded by Résumé, identifying clues are hidden, and all controls share insertion-order semantics.                                                                  |
| P6.6 | Ballot lifecycle | One owner draft per season/week autosaves; submission locks/reveals an immutable ballot; restart replaces the draft; revealed comparisons include Power, Résumé, AP, CFP, and prior ballot. |

**Exit condition:** one selected edition reproduces its Résumé, schedule classifications, playoff field, and complete blind-ballot seed without later-season leakage.

## Phase 7 — Draft and NFL tracking

**Goal:** Follow every Michigan alumnus from the 2015 cohort through league entry and career outcomes without expanding into general NFL coverage.

| ID   | Work package         | Acceptance evidence                                                                                                                 |
| ---- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| P7.1 | Entry outcomes       | Draft selections, UDFAs, practice-squad first entries, and later entrants attach to the canonical Person with source/quality state. |
| P7.2 | NFL identities       | nflverse and owner identities use confirmed matching and unresolved queues; team/status history never creates duplicate people.     |
| P7.3 | Weekly rosters       | Active, practice squad, injured/reserve, and other reserve states retain weekly history.                                            |
| P7.4 | Games/statistics     | Alumni-only games, starts, phase snaps, and conventional statistics retain source grain and null semantics.                         |
| P7.5 | Summaries/enrichment | Season/career summaries, combine/draft facts, and optional owner evaluations/honors remain traceable and reproducible.              |
| P7.6 | Public integration   | Michigan player profiles and alumni views expose NFL timelines without unrelated league data.                                       |

**Exit condition:** a drafted player, UDFA, practice-squad player, and later entrant each have a source-backed end-to-end Michigan-to-NFL timeline.

## Phase 8 — Operational hardening

**Goal:** Make imports, publication, recovery, and private ownership safe enough for sustained use under the free operating target.

| ID   | Work package           | Acceptance evidence                                                                                                                                  |
| ---- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| P8.1 | Backup/restore         | Versioned Michigan export and restore are tested against representative data and documented with recovery ownership.                                 |
| P8.2 | Authentication         | Replace the transitional deployment-key page gate with a private single-owner authentication boundary; no multi-user role system is introduced.      |
| P8.3 | Failure/staleness      | Last-valid data, freshness indicators, core publication blocks, and optional-enrichment degradation are exercised end to end.                        |
| P8.4 | Sync recovery          | Retry, idempotency, reconciliation, and correction workflows recover without duplicate or empty replacement records.                                 |
| P8.5 | Pruning                | Transient payload and rolling-detail deletion proves exact scope and preserves immutable/history records.                                            |
| P8.6 | Data-quality dashboard | Owner sees source health, unresolved identities, duplicates, incomplete seasons, invalid grades, eligibility warnings, and publication blockers.     |
| P8.7 | Migration rehearsal    | Migration tests exercise dry run, partial failure, idempotent retry, reconciliation, and full restore against representative snapshots.              |
| P8.8 | Release hardening      | CI, integration/end-to-end/accessibility coverage, deployment smoke tests, rollback, and free-tier capacity monitoring are documented and exercised. |

**Exit condition:** a failed sync, bad bulk import, lost mutable record, stale source, and blocked edition publication each have a tested recovery or safe-failure path.

## Phase 9 — Final UI redesign

**Goal:** Redesign the public and owner experiences after complete functionality is demonstrable through stable contracts.

| ID   | Work package              | Acceptance evidence                                                                                                                               |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| P9.1 | Information architecture  | Routes and navigation cover Michigan, national, ranking, matchup, playoff, ballot, NFL, and admin workflows without exposing internal data shape. |
| P9.2 | Design system             | Responsive tokens/components preserve Michigan-first identity, readability, visible focus, and accessible contrast.                               |
| P9.3 | Dense exploration         | Tables, comparisons, timelines, charts, and filters work at narrow and wide widths with loading/error/empty/stale states.                         |
| P9.4 | Admin efficiency          | Keyboard-friendly entry, previews, bulk reports, queues, confirmation, and recovery affordances make destructive scope explicit.                  |
| P9.5 | Accessibility/performance | Automated and manual checks cover semantic structure, keyboard/focus behavior, reduced motion, responsive rendering, and bounded data loading.    |

**Exit condition:** all stable workflows pass their end-to-end and accessibility checks in the redesigned UI; no redesign task changes a domain contract merely to fit presentation.

## Deferred selections, not product blockers

The following remain engineering selections inside approved boundaries:

- the single-owner authentication provider/mechanism in P8.2;
- which richer Power feature set, if any, passes P5.4;
- the exact free-tier scheduling/caching implementation; and
- the final visual language in phase 9.

If a future proposal changes the Michigan-only player archive, public/private ownership, $0 target, source authority, immutable-output rules, or explicit non-goals, it is a product-scope change and requires a new decision rather than an ordinary backlog edit.
