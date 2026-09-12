# Backend architecture

[Architecture index](README.md) · [Wiki home](../README.md)

## Boundary

Convex is the database, function runtime, real-time transport, and generated client contract. Authored code lives under `convex/`; `_generated/` is CLI output and must never be hand-edited.

## Current source model

`convex/schema.ts` declares 43 tables and 105 indexes. The principal ownership seams are:

| Boundary            | Retained state                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Michigan identity   | one Person, commitments, multiple roster stints, annual Player Seasons, repeatable evaluations, provider identities, unresolved matches, movement, and draft outcomes |
| Michigan games      | one Player Game per person/game with independent offense, defense, and special-teams snaps/grade pairs plus conventional statistics                                   |
| National college    | programs, aliases, historical affiliations/venues, compact games from 2000, rolling five-year detailed features, season context, drafts, and external polls           |
| Derived CFB26       | immutable edition metadata/snapshots, frozen forecasts, deterministic playoff projections, and one owner ballot per season/week                                       |
| Michigan alumni NFL | confirmed nflverse identities, weekly roster states, games, phase snaps, conventional statistics, and season summaries                                                |
| Operations          | owner sessions, revision-bound backup manifests, operation runs, owner audit events, Michigan revision state, and overwrite-oriented sync state                       |

Owner facts and corrections are mutable current values. Historical games, official editions, frozen forecasts, submitted ballots, Michigan Player Games, and alumni NFL history are retained. Raw API responses and import payloads are not stored.

College games optionally retain compact competitive per-play and drive aggregates with observation timestamps, plus sourced cancellation evidence. Season profiles optionally retain passing/receiving returning usage. `ratingEvidence` validates season-wide CFBD advanced-game and drive feeds and writes batches of at most 40 games. Its daily 11:27 UTC action refreshes FCS schedules first, then evidence, before the 11:47 ratings job. Full raw drives are discarded after aggregation. Failed enrichment preserves the last valid inputs; edition fingerprints include its sync vintage. Public schedules and evaluation targets exclude FCS-only games.

## Execution flow

```text
CFBD ──────> validated adapter ──> bounded sync batches ──> national tables
                                                        └─> Power/Résumé editions
nflverse ──> CSV adapter ───────> confirmed alumni only ─> NFL history
owner ─────> 12-hour session ───> transactional mutations > Michigan tables + revision/audit
public UI <────────────────────── bounded indexed queries <─┘
```

Sync state is set to running before an external request and succeeded/failed afterward. A failed or empty source response does not delete the last valid football data. `ratings.publicationReadiness` prevents an official edition when core game data is failed, empty, or has never succeeded; optional enrichment remains visible without blocking.

## Domain invariants

- Commitment and enrollment are separate. Decommitting never creates a roster stint.
- Player Seasons carry exact listed position and derived room, explicit scholarship/availability states, eligibility evidence, and optional override.
- `0` snaps means confirmed no participation; `null` means unknown. A grade with explicit zero snaps is rejected.
- Season grade summaries weight only grades with known positive snaps. Unknown-snap grades remain separate coverage.
- Provider identities are never guessed. Ambiguous source records enter the owner queue.
- Consequential Michigan owner writes advance one monotonic data revision and append an actor/session/action/target/result audit event in the same transaction.
- Material import, rollover, merge, and delete require a backup manifest matching the current revision and run transactionally.
- Version-3 backup fingerprints include the Michigan revision. The offline restore preparer remains compatible with version 2.
- Official editions, frozen forecasts, and submitted ballots are not overwritten.
- National reads and syncs are bounded; growing tables use indexes and batch sizes.

## Source and hosted status

The source authority is CFBD for national college facts, nflverse for Michigan-alumni NFL performance, the owner for Michigan-specific facts/corrections, and CFB26 for derived outputs. OpenSheet and PFF paths are absent.

The 41-table model was synchronized to both environments on 2026-09-07; see the [cutover record](../operations/convex-v2-cutover-2026-09-07.md). Development `adjoining-opossum-710` validated the backward-compatible 43-table three-rating contract on 2026-09-12 after a fresh export. No manifest-retirement migration was run. Production delivery to `doting-chipmunk-7` follows the main-branch Convex-first Vercel build; source publication is not evidence of a new data migration. Four retired physical table names remain visible but empty.

## Development loop

1. Read the owning domain/query module and schema indexes.
2. Change source, pure invariants, and tests together.
3. Run `npm run check`.
4. Update [Current contracts](../reference/current-contracts.md).
5. Only with exact-target authorization, push once to development and inspect generated types and live behavior before production.
