# Vision and end goal

[Product index](README.md) · [Wiki home](../README.md)

## End goal known today

Build a production-capable Michigan football personnel explorer on TanStack Start with Convex as its typed, real-time backend. The repository should remain easy for humans and coding agents to understand, change, verify, and deploy.

The implemented core workflow is browsing Michigan player history by depth chart, recruiting class, draft class, position, and player, plus national team rankings and matchups. One owner can maintain current roster facts through a narrowly protected editor. The primary audience and decisions for a broader multi-user product remain **Undecided**.

## Current experience

**Current**

- `/` presents the 2026 depth chart immediately, then progressively loads recruiting, career, movement, and NFL details for all 428 players.
- Users can browse by original recruiting class, NFL entry class, exact Michigan position, 2015–2025 snap-count/PFF season, or the full searchable player index and open a detailed player drawer.
- Checked-in source uses stored 2000–2026 games to build points-scale Power Ratings, Week 7 Résumé Ratings, immutable historical editions, and venue-aware matchup projections. The 21-table contract has not been pushed: development still hosts the prior 19-table percentile composite and production remains on the earlier foundation.
- `/admin/roster` separates current-player maintenance from recruit/transfer/walk-on arrivals and confirmed departures. Additions create the normalized player lifecycle atomically; removals retain history. The checked-in arrival/departure functions still need a development push, and every write remains disabled until that deployment also has a Convex admin key.
- The app can be type-checked and production-built locally.
- Repository guidance, task skills, and this wiki define the maintenance workflow.

Public browsing defaults to the development deployment. The only write surface is the single-owner roster editor established by [ADR 0005](../decisions/0005-single-owner-roster-admin-key.md); all of its mutations fail closed without the server key. The Vercel project and production domain are known, but the Nitro-backed release path still needs a successful production redeploy and smoke test.

## Foundation success criteria

The foundation is ready for product work when:

1. The hosted football schema/public reads remain synchronized through development-first Convex validation.
2. A one-page product brief defines the primary user, problem, and explicit non-goals around the implemented browsing workflow.
3. Identity, role authorization, and public-data policy are decided before adding multiple users or private records; the current owner-only write remains narrowly scoped.
4. Quality checks and deployment configuration run consistently in the target environment.

## Delivery stages

| Stage                    | Status        | Exit condition                                                                           |
| ------------------------ | ------------- | ---------------------------------------------------------------------------------------- |
| 0. Technical foundation  | **Complete**  | App builds; docs and agent workflows match the repository.                               |
| 1. First vertical slice  | **Current**   | Michigan player browsing works end to end against development data.                      |
| 2. Deployment connection | **Planned**   | The Nitro-backed production web deployment is redeployed and smoke-tested.               |
| 3. Product definition    | **Undecided** | Audience, broader problem, non-goals, and multi-user workflows are approved.             |
| 4. Production hardening  | **Undecided** | Auth, tests, observability, accessibility, and release policy meet defined requirements. |

## Decisions required before domain work

| Decision                   | Why it matters                                                | Status        |
| -------------------------- | ------------------------------------------------------------- | ------------- |
| Primary user and problem   | Determines routes, language, and success metrics.             | **Undecided** |
| Core workflow              | Browse the roster and player history across football cohorts. | **Current**   |
| Data ownership and privacy | Determines schema, auth, retention, and access rules.         | **Undecided** |
| Authentication provider    | Determines identity integration and protected-route design.   | **Undecided** |
| Brand and visual direction | Determines whether the splash palette remains.                | **Undecided** |
| Production host/project    | Vercel project `cfb` at `https://cfb-hazel.vercel.app`.       | **Current**   |

When one of these becomes decided, update this page, the affected architecture/operations pages, and add an ADR when the decision has durable technical consequences.
