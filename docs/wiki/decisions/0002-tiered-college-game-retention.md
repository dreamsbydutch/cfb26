# ADR 0002: Tiered college-game retention

- Status: Accepted
- Date: 2026-08-23

## Context

Team pages need game-by-game inputs for Elo-style ratings and head-to-head history. Detailed team totals are useful for recent-season analysis but would grow indefinitely if retained at the same horizon as schedules. Sports Reference was considered as a scrape target, but its automated access blocks and published [data-use terms](https://www.sports-reference.com/data_use.html) make it unsuitable as the supported ingestion path without separate permission.

## Decision

Use CollegeFootballData's authenticated API for game ingestion. Keep one compact `collegeGames` document for every available season from 2000 onward and retain `teamGameStats` for only the latest five season years. Synchronization is idempotent, internal, batched, credential-gated, and backfilled in restartable chunks of at most five seasons. A daily development job refreshes the current season and prunes detailed rows older than the rolling window.

Expose bounded reads by season/week, program/range, matchup, and source game ID. Keep provider IDs and labels beside canonical program references so a future provider migration does not erase source evidence.

## Consequences

- Matchup history and Elo reconstruction can use the compact long-range table without paying for decades of duplicated stat maps.
- Recent analytics retain flexible source categories without expanding the schema for every metric.
- The API key must be installed independently in each Convex environment, and a new environment has no game data until its initial backfill runs.
- Source availability, coverage, corrections, and rate limits remain external dependencies.
- Production promotion remains a separate explicit operation.

[Back to architecture decisions](README.md)
