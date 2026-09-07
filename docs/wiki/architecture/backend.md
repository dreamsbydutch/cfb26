# Backend architecture

[Architecture index](README.md) · [Wiki home](../README.md)

## Boundary

Convex is the database, function runtime, real-time transport, and generated client contract. Authored code lives under `convex/`; `_generated/` is CLI output and must never be hand-edited.

## Current source model

`convex/schema.ts` declares 41 tables and 103 indexes. The principal ownership seams are:

| Boundary            | Retained state                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Michigan identity   | one Person, commitments, multiple roster stints, annual Player Seasons, repeatable evaluations, provider identities, unresolved matches, movement, and draft outcomes |
| Michigan games      | one Player Game per person/game with independent offense, defense, and special-teams snaps/grade pairs plus conventional statistics                                   |
| National college    | programs, aliases, historical affiliations/venues, compact games from 2000, rolling five-year detailed features, season context, drafts, and external polls           |
| Derived CFB26       | immutable edition metadata/snapshots, frozen forecasts, deterministic playoff projections, and one owner ballot per season/week                                       |
| Michigan alumni NFL | confirmed nflverse identities, weekly roster states, games, phase snaps, conventional statistics, and season summaries                                                |
| Operations          | owner sessions, backup manifests, operation runs, and overwrite-oriented sync state                                                                                   |

Owner facts and corrections are mutable current values. Historical games, official editions, frozen forecasts, submitted ballots, Michigan Player Games, and alumni NFL history are retained. Raw API responses and import payloads are not stored.

## Execution flow

```text
CFBD ──────> validated adapter ──> bounded sync batches ──> national tables
                                                        └─> Power/Résumé editions
nflverse ──> CSV adapter ───────> confirmed alumni only ─> NFL history
owner ─────> 12-hour session ───> transactional mutations > Michigan tables
public UI <────────────────────── bounded indexed queries <─┘
```

Sync state is set to running before an external request and succeeded/failed afterward. A failed or empty source response does not delete the last valid football data. `ratings.publicationReadiness` prevents an official edition when core game data is failed, empty, or has never succeeded; optional enrichment remains visible without blocking.

## Domain invariants

- Commitment and enrollment are separate. Decommitting never creates a roster stint.
- Player Seasons carry exact listed position and derived room, explicit scholarship/availability states, eligibility evidence, and optional override.
- `0` snaps means confirmed no participation; `null` means unknown. A grade with explicit zero snaps is rejected.
- Season grade summaries weight only grades with known positive snaps. Unknown-snap grades remain separate coverage.
- Provider identities are never guessed. Ambiguous source records enter the owner queue.
- Material import, rollover, merge, and delete require an existing backup manifest and run transactionally.
- Official editions, frozen forecasts, and submitted ballots are not overwritten.
- National reads and syncs are bounded; growing tables use indexes and batch sizes.

## Source and hosted status

The source authority is CFBD for national college facts, nflverse for Michigan-alumni NFL performance, the owner for Michigan-specific facts/corrections, and CFB26 for derived outputs. OpenSheet and PFF paths are absent.

The 41-table source model has not been synchronized to either recorded deployment. Their older hosted state remains documented in [Deployment](../guides/deployment.md); a source contract is not production behavior until migration and smoke checks succeed against the named target.

## Development loop

1. Read the owning domain/query module and schema indexes.
2. Change source, pure invariants, and tests together.
3. Run `npm run check`.
4. Update [Current contracts](../reference/current-contracts.md).
5. Only with exact-target authorization, push once to development and inspect generated types and live behavior before production.
