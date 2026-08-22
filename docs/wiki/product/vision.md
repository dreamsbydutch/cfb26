# Vision and end goal

[Product index](README.md) · [Wiki home](../README.md)

## End goal known today

Build a production-capable Michigan football personnel explorer on TanStack Start with Convex as its typed, real-time backend. The repository should remain easy for humans and coding agents to understand, change, verify, and deploy.

The implemented core workflow is browsing Michigan player history by depth chart, recruiting class, draft class, position, and player. The primary audience and the decisions that would turn this read-only explorer into a broader product remain **Undecided**.

## Current experience

**Current**

- `/` presents the 2026 depth chart immediately, then progressively loads recruiting, career, movement, and NFL details for all 428 players.
- Users can browse by original recruiting class, NFL entry class, exact Michigan position, or the full searchable player index and open a detailed player drawer.
- Checked-in Convex source represents the eight hosted football tables and four public read functions. It is not yet push-validated against development, and production has no functions.
- The app can be type-checked and production-built locally.
- Repository guidance, task skills, and this wiki define the maintenance workflow.

The current route is the first product vertical. It is read-only and uses the public development deployment while the release path remains blocked.

## Foundation success criteria

The foundation is ready for product work when:

1. The recovered hosted football schema/public reads are reviewed and push-validated in development without losing the remaining internal functions.
2. A one-page product brief defines the primary user, problem, and explicit non-goals around the implemented browsing workflow.
3. Authentication, authorization, and public-data policy are decided before writes or private data are introduced.
4. Quality checks and deployment configuration run consistently in the target environment.

## Delivery stages

| Stage                    | Status        | Exit condition                                                                           |
| ------------------------ | ------------- | ---------------------------------------------------------------------------------------- |
| 0. Technical foundation  | **Complete**  | App builds; docs and agent workflows match the repository.                               |
| 1. First vertical slice  | **Current**   | Michigan player browsing works end to end against development data.                      |
| 2. Deployment connection | **Planned**   | Backend source parity is reviewed, validated in development, and deployed safely.        |
| 3. Product definition    | **Undecided** | Audience, broader problem, non-goals, and write workflows are approved.                  |
| 4. Production hardening  | **Undecided** | Auth, tests, observability, accessibility, and release policy meet defined requirements. |

## Decisions required before domain work

| Decision                   | Why it matters                                                | Status        |
| -------------------------- | ------------------------------------------------------------- | ------------- |
| Primary user and problem   | Determines routes, language, and success metrics.             | **Undecided** |
| Core workflow              | Browse the roster and player history across football cohorts. | **Current**   |
| Data ownership and privacy | Determines schema, auth, retention, and access rules.         | **Undecided** |
| Authentication provider    | Determines identity integration and protected-route design.   | **Undecided** |
| Brand and visual direction | Determines whether the splash palette remains.                | **Undecided** |
| Production host/project    | Determines environment management and release ownership.      | **Undecided** |

When one of these becomes decided, update this page, the affected architecture/operations pages, and add an ADR when the decision has durable technical consequences.
