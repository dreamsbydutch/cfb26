# ADR 0011: Replace PFF data with CFB26 Player Grades

- Status: Accepted
- Date: 2026-09-06

## Context

The current repository stores a manually assembled `SnapCounts.json` source, PFF season grades, associated season snaps, and a PFF-specific preparation/import/read path. The source has incomplete identity coverage, combines proprietary grades with participation data, and cannot support the intended owner-entered game-by-game workflow. Relabeling those values would erase provenance rather than create a CFB26 measure.

The owner needs to record subjective grades and participation independently for offense, defense, and special teams while preserving the difference between a confirmed zero and unknown coverage.

## Decision

PFF is outside the product. During a backed-up controlled migration, delete existing PFF grades and their associated snap data, remove `SnapCounts.json`, remove the PFF-specific parser/import/query/presentation path, and do not relabel any value.

Replace that contract with owner-authored `CFB26 Player Grades` attached to one Michigan Player Game. Each phase has independent nullable snaps and grade values. Zero snaps means confirmed non-participation, null snaps means unknown, and null grade means ungraded. A phase with explicit zero snaps cannot have a grade; a phase with unknown snaps may have a grade but remains visibly outside snap-weighted coverage.

Grades use 0–100 with one decimal place. Phase season grades are weighted only by known positive snaps. Unknown-snap grades remain separately summarized. Conventional CFBD statistics stay separate from subjective CFB26 grades.

## Consequences

- The PFF deletion is intentionally destructive and cannot run until a Michigan export and restore have been verified against the exact target environment.
- Historical workload reports remain repository history until phase 1; after removal, documentation must not present their source as an active product contract.
- Player-game entry and imports need validation for range, precision, uniqueness, zero/null semantics, and identity resolution.
- Public views must label the measure exactly as CFB26 Player Grades and expose incomplete coverage.
- CFB26 Player Grades never become inputs to national Power.

[Back to architecture decisions](README.md)
