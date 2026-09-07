# ADR 0005: Gate roster administration with a deployment secret

- Status: Accepted
- Date: 2026-08-23
- Amended: 2026-09-06 to exchange the secret for revocable sessions

## Context

The product needs one owner to maintain current football facts and record roster arrivals/departures before it needs user accounts. The existing application has public football reads and no identity provider. A browser-only admin flag would expose writes to anyone, while selecting and operating a full account provider would add product decisions that are not yet required.

## Decision

Protect owner functions with a high-entropy `CFB26_ADMIN_KEY` stored in the target Convex deployment environment. The owner submits it only to `rosterAdmin.login`; Convex compares it in constant time, creates a random 32-byte token, stores only its SHA-256 hash, and expires it after 12 hours. The browser persists the token so a refresh does not require resending the password. Logout revokes the server session, and every owner function verifies expiry/revocation.

The protected functions remain within the canonical Michigan lifecycle and system operations: people/stints/seasons/games/evaluations/NFL gaps, imports, backups, rollover, identity repair, season rules, and health. Public reads expose the intended football facts. This gate identifies one owner principal and does not establish multiple identities, roles, tenants, or social accounts.

## Consequences

- Each deployment needs its own key, configured outside tracked files and never under a `VITE_*` name.
- Losing or rotating the key requires changing the Convex environment value and using the owner control to revoke all existing sessions.
- Owner functions accept a high-entropy session token, never the password. A future multi-user product must replace this gate with identity and explicit role authorization.
- Session storage contains only the token; it remains sensitive and must never appear in logs or URLs.
- A deployment receives neither new mutations nor its key until an explicit push/promotion.

[Back to architecture decisions](README.md)
