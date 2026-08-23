# ADR 0005: Gate roster administration with a deployment secret

- Status: Accepted
- Date: 2026-08-23

## Context

The product needs one owner to correct depth-chart placement, eligibility, injuries, and positions before it needs user accounts. The existing application has public football reads and no identity provider. A browser-only admin flag would expose writes to anyone, while selecting and operating a full account provider would add product decisions that are not yet required.

## Decision

Add one narrowly scoped roster mutation protected by a high-entropy `CFB26_ADMIN_KEY` stored in the target Convex deployment environment. The admin enters the key for the current page session; the browser does not persist it. Convex compares it before any read or write and rejects every update when the environment variable is absent, too short, or different.

The mutation edits the existing canonical roster stint atomically. It may set an explicit depth tier, add zero to five eligibility seasons, record one current injury state, and change the current position while appending a bounded position-change history. Public roster reads continue to expose these football facts so the roster UI can render them. This gate is for a single owner and does not establish user identity, roles, tenants, or private records.

## Consequences

- Each deployment needs its own key, configured outside tracked files and never under a `VITE_*` name.
- Losing or rotating the key requires changing the Convex environment value; no recovery or session system exists in the app.
- The mutation accepts an unguessable credential argument. A future multi-user product must replace this gate with an identity provider and explicit role authorization rather than extending it into an account system.
- Position history is capped at the latest 20 changes and injury state represents current public availability, not a medical record.
- Production receives neither the mutation nor its key until an explicit promotion.

[Back to architecture decisions](README.md)
