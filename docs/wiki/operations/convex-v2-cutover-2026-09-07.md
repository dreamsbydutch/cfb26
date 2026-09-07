# Convex v2 cutover — 2026-09-07

[Operations index](README.md) · [Wiki home](../README.md)

## Outcome

Development deployment `adjoining-opossum-710` and production deployment `doting-chipmunk-7` now run the checked-in 41-table Michigan/national/NFL/operations contract in Convex project `dreamsbydutch:michigan`.

The operation exported each target before mutation, audited and prepared its own legacy Michigan snapshot, cleared only the eight incompatible or retired Michigan tables, synchronized the new schema and functions, imported v2 data in relationship order, and reconciled counts. The production operation was separately authorized against the named deployment. It did not deploy the Vercel web application.

Four retired physical table names — `legacyPlayerRows`, `recruitingProfiles`, `seasonalPlayerStats`, and `programCareerSummaries` — remain visible in hosted storage with zero documents. They are not part of the 41 declared source tables.

## Pre-operation recovery points

| Target      | Snapshot identifier   | Local archive SHA-256                                              | Legacy source fingerprint                                          |
| ----------- | --------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Development | `1788759459375105795` | `DFE8A5343856B96C7BAEE949BB259275235D44F872AE92A97C228B87215C7C86` | `6B9DC961754514A3B816CFC4B888A250A564485932A782F83056D8803B03DF01` |
| Production  | `1788792325980807109` | `A2E7FE8233208A4532CBF9159A371856453957029DCD57A31F17C3260828AC04` | `2A915D1EC05840DED48AE959512E8964FE1A1705063563CF9C883984CD7F61AD` |

The archives and prepared migration output are held outside the repository because they contain application data. No secret or snapshot payload is checked in.

## Migration reconciliation

Both dry runs reported 921 proprietary PFF season rows for intentional deletion and zero unresolved identities. No PFF value was relabeled or imported.

| Target      | Legacy documents cleared | People | Commitments | Roster stints | Player Seasons | Evaluations | Movements | Draft outcomes |
| ----------- | -----------------------: | -----: | ----------: | ------------: | -------------: | ----------: | --------: | -------------: |
| Development |                    3,890 |    428 |          16 |           412 |          1,147 |         680 |       720 |            109 |
| Production  |                    3,892 |    428 |          16 |           412 |          1,146 |         680 |       722 |            109 |

The one Player Season and two movement-event differences reflect the distinct pre-operation snapshots; each target was migrated from and reconciled to its own source data rather than forcing development and production to match.

## Verification

- Development schema synchronization completed through `npx convex dev --once` after the scoped legacy-table clear.
- Production schema and function promotion completed through an explicitly confirmed `npx convex deploy` to `doting-chipmunk-7`.
- The deployed function surface includes the public roster, player, weekly rating, merit, and matchup reads plus the private owner session and health workflows.
- Development public reads returned 120 Michigan roster entries for 2026, one Bryce Underwood search result, and 142 games with 136 rating rows for 2025 Week 1.
- Production public reads returned 119 Michigan roster entries for 2026, one Bryce Underwood search result, and 142 games with 136 rating rows for 2025 Week 1.
- Both 2026 roster dashboards reported zero commitments and two data-quality warnings.
- All seven imported v2 datasets matched their prepared per-target counts, and all four retired table names were empty.

The operation preserved existing national data. It did not run CFBD or nflverse synchronization, populate newly introduced datasets that require source sync or owner input, exercise an owner mutation, or publish a web build.

## Recovery

- A data rollback begins from the exact target's pre-operation snapshot, never the other environment's snapshot.
- Restoring a pre-operation snapshot also requires deploying source compatible with that older data contract; importing the archive alone does not roll back functions, validators, or indexes.
- Keep target name, snapshot identifier, archive hash, and legacy fingerprint together during recovery.
- A restore drill remains outstanding and must use a disposable deployment before any production rollback.
