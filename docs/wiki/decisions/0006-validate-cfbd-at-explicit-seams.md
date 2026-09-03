# ADR 0006: Validate CFBD at explicit seams

- Status: Accepted
- Date: 2026-09-02

## Context

The rating system depends on several CFBD endpoints with different coverage, entitlement, and freshness behavior. An HTTP success does not prove that a response still matches the expected contract or that related datasets reconcile. Tests coupled to private parser details would also become brittle as ingestion evolves.

## Decision

Test three stable boundaries: the authenticated CFBD client, a pure as-of-week season audit, and a read-only operational canary. Keep offline fixtures free of secrets and network access. Treat games, team box scores, FBS membership, and ordinary season stats as required canary inputs; report richer preseason sources independently as optional. Classify failures and retry only transient network, rate-limit, and server responses within a small bound.

The complete local quality gate runs the offline tests. Live probes remain explicit operations against a confirmed Convex deployment and never push code or write football data.

## Consequences

- Contract drift and cross-endpoint inconsistencies fail close to the source boundary.
- Local and build verification does not consume CFBD quota or require a secret.
- A passing one-week canary does not establish historical completeness; coverage audits remain necessary before a feature enters a trained rating model.
- Staged atomic activation is still required before the season audit can prevent partial replacement in the existing game sync.

[Back to architecture decisions](README.md)
