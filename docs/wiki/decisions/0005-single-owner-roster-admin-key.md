# ADR 0005: Gate roster administration with a deployment secret

- Status: Accepted
- Date: 2026-08-23

## Context

The product needs one owner to maintain current football facts and record roster arrivals/departures before it needs user accounts. The existing application has public football reads and no identity provider. A browser-only admin flag would expose writes to anyone, while selecting and operating a full account provider would add product decisions that are not yet required.

## Decision

Add narrowly scoped roster mutations protected by a high-entropy `CFB26_ADMIN_KEY` stored in the target Convex deployment environment. The admin enters the key for the current page session; the browser does not persist it. Convex compares it before any read or write and rejects every update when the environment variable is absent, too short, or different.

The mutations remain within the canonical player lifecycle. One edits an existing stint's depth, eligibility, injury, and position facts. One creates the normalized identity, recruiting profile, active Michigan stint, zeroed career summary, and arrival event for a recruit, transfer, or walk-on. One closes an active stint and records a transfer, graduation, retirement, or dismissal without deleting player history. Public roster reads continue to expose these football facts so the roster UI can render them. This gate is for a single owner and does not establish user identity, roles, tenants, or private records.

## Consequences

- Each deployment needs its own key, configured outside tracked files and never under a `VITE_*` name.
- Losing or rotating the key requires changing the Convex environment value; no recovery or session system exists in the app.
- The mutations accept an unguessable credential argument. A future multi-user product must replace this gate with an identity provider and explicit role authorization rather than extending it into an account system.
- Position history is capped at the latest 20 changes and injury state represents current public availability, not a medical record.
- A deployment receives neither new mutations nor its key until an explicit push/promotion.

[Back to architecture decisions](README.md)
