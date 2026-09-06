# ADR 0010: Model one person with Michigan stints and Player Seasons

- Status: Accepted
- Date: 2026-09-06

## Context

The current Michigan model centers one roster stint and cumulative/seasonal imports around each canonical player. That shape cannot represent a decommit without implying enrollment, multiple Michigan stints, season-specific roster/eligibility facts, or repeated evaluations without overwriting earlier values. Creating a new player row for each stint would fragment one person's Michigan, draft, and NFL history.

The product needs a small create contract because new commitments often have little confirmed data. Provider identities are sometimes ambiguous and must not be treated as canonical through an unreviewed fuzzy match.

## Decision

Represent each human as one canonical `Person`. Keep commitment and enrollment separate, attach zero or more Michigan stints to the person, and attach one `Player Season` per person/Michigan stint/season.

A Player Season owns season-specific listed position, derived room, measurements, scholarship and roster/depth status, role/order, eligibility evidence, games/starts, availability, distinctions, sources, and quality state. A later return to Michigan creates another stint under the same person.

Recruiting, transfer, and draft evaluations are repeatable dated events with provider, scale, score/rank, and direction. They are not current-value columns on Person or Player Season.

The minimum person creation input is canonical name, entry season, entry method, initial position, and prospect/enrolled state. Provider records link automatically only through exact stable identity; otherwise the owner resolves them through an explicit queue.

## Consequences

- Decommits remain prospect history and never become roster players.
- Transfers out and back can preserve distinct Michigan stints without duplicating the person.
- Season rosters, eligibility, development, and returning production derive from Player Seasons rather than a flattened career row.
- Existing roster tenure requires a controlled migration into season rows before downstream player-game and NFL work.
- Duplicate merge and erroneous-record deletion must update all dependent identities transactionally and require a backup.
- Current lifecycle tables remain current evidence until phase 1 completes; this ADR does not claim that the target schema is already deployed.

[Back to architecture decisions](README.md)
