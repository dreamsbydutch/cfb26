# ADR 0012: Assign data authority and retention by domain

- Status: Accepted
- Date: 2026-09-06
- Implemented in source: 2026-09-06
- Extends: [ADR 0002](0002-tiered-college-game-retention.md)

## Context

The target system joins national college data, owner-maintained Michigan facts, derived CFB26 publications, and Michigan-alumni NFL data. Treating every source as equally authoritative would permit imports to overwrite owner corrections or derived outputs. Retaining every raw response would work against the $0 operating target, while overwriting official editions or forecasts would make historical claims irreproducible.

The pre-v2 OpenSheet feeds added an avoidable intermediary over source data. Sports Reference and Football Reference scraping are not supported ingestion paths.

## Decision

Assign authority as follows:

- CFBD owns national college programs, games, schedules, statistics, recruiting/talent/portal, draft, and related source facts.
- The owner owns Michigan lifecycle facts, corrections, grades, and gaps.
- nflverse owns NFL roster and performance facts for Michigan alumni.
- CFB26 owns derived ratings, forecasts, summaries, quadrants, projections, and classifications.

Replace OpenSheet dependencies with validated CFBD boundaries. Retain only data required for identity, reliable rendering, historical calculations, and frozen outputs:

- compact national games from 2000 onward, Power/Résumé editions from 2015 onward, frozen forecasts, submitted ballots, Michigan player games, and Michigan-alumni NFL weekly/game history are permanent;
- detailed national team-game features use a rolling five-year window;
- raw API responses, raw play-by-play, and import payloads are transient;
- latest synchronization state and owner mutable fields overwrite their current value; and
- official editions and frozen forecasts are immutable.

Required-source failure preserves the last valid data and blocks official publication when core evidence is incomplete. Optional enrichment failure preserves prior values, reports staleness, and does not block publication.

## Consequences

- Provider payloads are validation inputs, not a public mirror or permanent archive.
- Every stored fact needs source/quality metadata sufficient to resolve authority and staleness.
- Sync implementations must be idempotent and must never replace valid records with an empty failure response.
- Historical corrections to immutable output create an amendment or later edition rather than an overwrite.
- Import, cache, pruning, and backup jobs need explicit retention tests and bounded batches.
- The product remains viable only while the required free sources and allowances meet its workload; paid data is not an automatic fallback.

[Back to architecture decisions](README.md)
