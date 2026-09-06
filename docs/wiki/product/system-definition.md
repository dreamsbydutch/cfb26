# CFB26 system definition

[Product index](README.md) · [Implementation backlog](implementation-backlog.md) · [Wiki home](../README.md)

## Status and purpose

**Planned — approved 2026-09-06:** CFB26 is a Michigan-first college football intelligence system. It joins Michigan recruiting, roster, development, game, departure, draft, and NFL-career history with national team, schedule, rating, résumé, playoff, and matchup analysis.

This page is the canonical target product contract. It records approved behavior, not behavior already shipped. [Vision](vision.md) summarizes the destination and [Current contracts](../reference/current-contracts.md) inventories the application as it exists today. When the two differ, the current-contract page governs claims about shipped behavior and this page governs implementation direction.

The target has four operating constraints:

1. Public exploration is read-only.
2. One private owner maintains mutable Michigan-specific data and publishes immutable outputs.
3. The operating target is $0 per month, using free data sources and service allowances.
4. Stable workflows and data contracts come before the final UI redesign.

No major product decision blocks the implementation sequence. Later engineering work may still select an authentication mechanism, a promoted Power challenger, and the final visual system without changing this product boundary.

## Scope boundary

| Area                      | Included                                                                                                                                                                               | Boundary                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Michigan                  | Recruiting, commitments, rosters, player development, games, participation, grades, departures, draft outcomes, and NFL careers from the 2015 cohort onward                            | Michigan is the only complete college-player archive.                                         |
| National college football | Programs, affiliations, venues, schedules, results, compact statistics, recruiting/talent context, ratings, résumés, schedule strength, playoff projections, and hypothetical matchups | Store only facts needed for identity, rendering, historical calculations, and frozen outputs. |
| NFL                       | Draft/UDFA entry and weekly, game, season, and career outcomes for Michigan alumni                                                                                                     | Do not become a general NFL statistics site.                                                  |
| Administration            | Single-owner lifecycle maintenance, imports, reconciliation, rollover, backup/restore, and data health                                                                                 | No collaborative editing, social features, or field-level revision history.                   |

## Michigan player domain

### Canonical lifecycle

A `Person` exists once even when the person has multiple Michigan stints or a later NFL identity:

```text
Michigan commitment → enrollment → one or more Player Seasons → departure → draft or UDFA outcome → NFL career
```

Commitment and enrollment are separate events. A decommitment remains part of prospect history and never creates an enrolled roster record. A player may enter Michigan as a recruit, transfer, or walk-on, leave, and later begin another Michigan stint without creating another person.

The minimum new-person contract is intentionally small:

- canonical name;
- entry season;
- entry method;
- initial listed position; and
- prospect or enrolled-roster state.

Provider identities and source records attach only after an exact or owner-confirmed match. Ambiguous records enter an unresolved queue; the system never guesses.

### Player Seasons

A `Player Season` represents one person's football status for one Michigan season within one Michigan stint. It may record:

- jersey number and exact listed position;
- derived position room;
- height and weight;
- scholarship status;
- roster status and depth status;
- starter, rotation, reserve, or unassigned role;
- position-room order;
- eligibility facts;
- games and starts;
- public injury/availability summary;
- captaincy, honors, and other football distinctions; and
- source links and data-quality state.

Recruiting, transfer, and draft evaluations are repeatable `Evaluation Events`, not permanent columns. An event may include provider, date, scale, score, rank, and direction. Transfer evaluations therefore preserve both inbound and outbound assessments without overwriting history.

[ADR 0010](../decisions/0010-model-one-person-with-stints-and-player-seasons.md) owns this identity and season model.

### Eligibility and roster limits

Eligibility is derived from season-specific rules rather than one universal five-year formula. The retained evidence includes enrollment seasons, competition participation, legacy redshirt treatment where applicable, medical hardship and other extensions, and modern age-based exceptions.

When the official result cannot be derived safely, the owner may set `eligibleThroughSeason`. The override is visible and takes precedence over the derived answer; it does not erase the underlying evidence.

Roster limits are also season-specific. A season view reports counted, exempt, and unknown players. Inconsistencies generate warnings but do not prevent the owner from recording reality.

## Michigan games and CFB26 Player Grades

Every Michigan player may have one `Player Game` for each Michigan game. Offense, defense, and special teams are independent, optional phases:

| Phase         |    Snaps |    Grade |
| ------------- | -------: | -------: |
| Offense       | Optional | Optional |
| Defense       | Optional | Optional |
| Special teams | Optional | Optional |

The contract preserves three distinct states:

- `0` snaps means the player definitively played no snaps in that phase.
- `null` snaps means the snap count is unknown.
- `null` grade means ungraded.

A grade is invalid when the corresponding phase has an explicit zero-snap count. A grade may be recorded while snaps are unknown, but the coverage state must remain visible.

CFB26 Player Grades use a 0–100 scale with one decimal place:

|      Score | Display band           |
| ---------: | ---------------------- |
| 90.0–100.0 | Elite                  |
|  80.0–89.9 | High quality           |
|  70.0–79.9 | Above average          |
|  60.0–69.9 | Slightly above average |
|  50.0–59.9 | Below average          |
|   0.0–49.9 | Poor                   |
|     `null` | Ungraded               |

Season grades are snap-weighted within each phase when snaps are known. Grades with unknown snaps remain separately summarized and are never quietly mixed into the weighted grade. Conventional CFBD player statistics appear separately from subjective CFB26 grades.

PFF is outside the target product. Phase 1 will delete the existing PFF grades and associated snap data through a backed-up, controlled migration; remove `SnapCounts.json` and its preparation/import path; and remove PFF presentation. Nothing will be relabeled to hide its origin, and no future PFF copy/paste workflow will exist. [ADR 0011](../decisions/0011-replace-pff-data-with-cfb26-player-grades.md) records the decision.

## Public application

### Michigan exploration

The public application will provide:

- Michigan season rosters from 2015 onward;
- complete player profiles and comparisons of up to four players;
- position-room, scholarship, eligibility, roster-limit, development, and returning-production views;
- game pages with pregame context, postgame results, participation, grades, and conventional statistics; and
- Michigan alumni draft and NFL-career tracking.

### National exploration

National views will provide:

- program profiles with schedules, historical affiliations, venues, recruiting/talent context, ratings, and draft production;
- CFB26 Power and CFB26 Résumé editions from 2015 onward;
- strength-of-schedule and quadrant breakdowns;
- scheduled and hypothetical matchup forecasts; and
- a season-specific projected playoff field and revealed all-FBS personal ranking ballots.

Historical ratings from 2015 onward are labeled reconstructions. Official prospective forecasts begin with the 2026 implementation and are never backfilled as if they existed before kickoff.

## CFB26 Power

CFB26 Power answers: “How strong is this team, and what should happen in a future matchup?”

The existing opponent-adjusted points model remains the baseline. A challenger may add compact, interpretable features such as PPA, success rate, explosiveness, finishing drives, havoc, run/pass performance, pace, special teams, penalties, and turnover regression. Preseason priors may use recent CFB26 performance, four-year talent/recruiting, returning production, transfers, and eventually coaching continuity. School brand and historic prestige never receive an unexplained bonus.

Priors fade as current-season evidence grows, and every published rating exposes remaining prior influence. A challenger becomes official only after improving held-out margin forecasting and probability calibration under [ADR 0007](../decisions/0007-optimize-predictions-with-held-out-seasons.md). Approval creates a documented model version; prior official editions remain immutable. Michigan owner grades never enter national Power.

A matchup forecast includes expected margin, win probability, uncertainty, venue/home-field effect, rating edition, and model version. User scenario adjustments are separate and explicitly labeled. Prospective forecasts freeze before kickoff; research backtests remain research artifacts.

## CFB26 Résumé and schedule strength

CFB26 Résumé answers: “What has this team earned through the selected cutoff?” It remains separate from predictive Power:

- completed results and schedule quality contribute 90%;
- capped dominance contributes 10%;
- opponent quality uses the selected edition's Power order;
- recruiting talent, program history, and conference identity do not directly boost a team's score;
- championship status affects playoff qualification, not Résumé score; and
- head-to-head, common opponents, and championships appear as evidence, not duplicate bonuses.

Résumé editions begin in Week 7. FCS games are displayed separately from FBS quadrants.

At each cutoff, completed FBS opponents use that edition's leakage-safe Power order:

| Quadrant |           Opponent Power order |
| -------- | -----------------------------: |
| Q1       |                           1–35 |
| Q2       |                          36–70 |
| Q3       |                         71–105 |
| Q4       | 106 through the final FBS team |

Each new edition reclassifies every previously played opponent using that edition's contemporaneous Power order. Earlier editions retain their earlier classifications, so future or end-of-season evidence never enters an earlier cutoff. Schedule views include played, remaining, and full strength; conference and nonconference splits; average opponent Power; expected wins for a top-25 benchmark; quadrant opportunities/results; and hardest-games-first ordering.

## Blind personal ranking ballot

The public application contains the identity-blind, all-FBS ballot workflow. The owner ranks in private; after submission, the locked and revealed ballot becomes public read-only evidence.

The ballot includes every FBS team active in the selected season. Its initial insertion order is seeded by CFB26 Résumé. During blind ranking, identities, conferences, logos, opponent names, and recognizable schedule clues are hidden; Résumé evidence and model-seeded position remain visible.

Moving, dragging, keyboard control, and direct rank entry all perform the same insertion operation: one team moves and displaced teams shift. One owner draft per season/week autosaves. Submitting locks and reveals the ballot. Starting over replaces the current saved ballot rather than creating revisions.

The revealed ballot compares with Power, Résumé, AP, CFP, and the previous ballot. Ties use Résumé score, harder schedule, Q1 wins, road/neutral success, capped dominance, then stable program key.

## Playoff projection

Each eligible ranking edition may produce a deterministic “selected today” field using that season's actual qualification rules. Before conference championship games, required champion slots use the highest-ranked eligible Résumé team in each applicable conference. Actual champions replace provisional champions once known.

The view explains each automatic bid, at-large selection, seed, bye, and first team out. It is a rules-based CFB26 projection, not a simulation of private committee reasoning.

## Player administration

The private owner area will support:

- commitments, decommitments, enrollment, Player Seasons, position/scholarship/depth changes, eligibility, availability, departures, and multiple Michigan stints;
- repeatable recruiting, transfer, and draft evaluations;
- player-game participation, snaps, grades, and conventional statistics;
- validated CSV/JSON bulk entry with a dry run;
- identity matching and unresolved-record queues;
- transactional duplicate merging and deletion of records created erroneously;
- previewed season rollover;
- data-health and synchronization status; and
- Michigan data export and restore.

Owner-authored mutable facts overwrite the current value. There is no field-level revision history. A backup is required before material bulk import, merge, delete, rollover, or migration operations.

## NFL tracking

NFL coverage follows Michigan alumni from the 2015 cohort onward, including drafted players, UDFAs, practice-squad players, and later entrants. It includes NFL identity and entry path; weekly active/practice-squad/injured/reserve status; games and starts; phase snaps and conventional statistics; season/career summaries; draft/combine information when available; and optional owner-authored evaluations and honors.

CFBD supplies draft history where appropriate, nflverse is the primary free NFL performance source, and the owner may fill gaps. Football Reference scraping is not supported.

## Data authority, retention, and resilience

| Authority | Owned facts                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| CFBD      | National college programs, games, schedules, statistics, recruiting, talent, portal, draft, and related source data |
| Owner     | Michigan-specific lifecycle facts, corrections, grades, and gaps                                                    |
| nflverse  | NFL roster and performance data for Michigan alumni                                                                 |
| CFB26     | Derived ratings, forecasts, summaries, quadrants, projections, and classifications                                  |

The application is not a raw CFBD mirror. Retention follows the smallest durable evidence needed for rendering and reconstruction:

| Data                                                 | Retention                |
| ---------------------------------------------------- | ------------------------ |
| Compact national games from 2000 onward              | Permanent                |
| Power/Résumé editions from 2015 onward               | Permanent                |
| Frozen forecasts and submitted ballots               | Permanent                |
| Michigan player-game history from 2015 onward        | Permanent                |
| Michigan alumni NFL weekly/game history              | Permanent                |
| Detailed national team-game features                 | Rolling five-year window |
| Raw API responses, play-by-play, and import payloads | Transient only           |
| Latest synchronization state                         | Overwritten              |
| Owner-entered mutable fields                         | Overwritten              |
| Official editions and frozen forecasts               | Immutable                |

Sync failures preserve the last valid data, expose staleness, and never replace good data with an empty response. Core-source failure blocks publication of an official edition; optional enrichment failure does not. [ADR 0012](../decisions/0012-assign-data-authority-and-retention.md) owns the authority and retention boundary.

## Explicit non-goals

CFB26 excludes:

- PFF ingestion, copying, or relabeling;
- Sports Reference or Football Reference scraping;
- paid data dependencies;
- betting recommendations;
- live/in-game ratings;
- raw play-by-play retention;
- national college-player archives;
- general NFL coverage;
- recruiting targets and offer tracking;
- NIL information;
- detailed medical records;
- social or multi-user rankings;
- notifications;
- native mobile applications; and
- a public data API or bulk public export.

## Delivery

Implementation follows the nine ordered phases in the [implementation backlog](implementation-backlog.md). Each phase ships as a coherent, tested slice. Phase 1 begins with an export and controlled migration; phase 9 performs the final UI redesign only after the underlying workflows and contracts are stable.
