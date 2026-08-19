# Vision and end goal

[Product index](README.md) · [Wiki home](../README.md)

## End goal known today

Build a production-capable React web application on TanStack Start with Convex as its typed, real-time backend. The repository should remain easy for humans and coding agents to understand, change, verify, and deploy.

That is the technical end goal. The product mission—who the app serves, which problem it solves, and its defining workflow—is **Undecided**. Agents must not infer that mission from the repository name, old files, sample copy, or the `numbers` demo.

## Current experience

**Current**

- `/` presents a responsive splash page and links to the TanStack and Convex documentation.
- `/anotherPage` reads sample numbers and can invoke an action that adds another number.
- Convex supplies the sample persistence layer and generated end-to-end types.
- The app can be type-checked and production-built locally.
- Repository guidance, task skills, and this wiki define the maintenance workflow.

The sample route and `numbers` table prove integration only. They are disposable once the first product vertical is defined.

## Foundation success criteria

The foundation is ready for product work when:

1. The intended Convex deployment is connected locally and the sample read/write loop is verified.
2. A one-page product brief defines the primary user, problem, core workflow, and explicit non-goals.
3. Authentication and authorization requirements are decided before private data is introduced.
4. The first vertical slice has a route, typed backend contract, useful empty/error states, and acceptance criteria.
5. Quality checks and deployment configuration run consistently in the target environment.

## Delivery stages

| Stage                    | Status        | Exit condition                                                                           |
| ------------------------ | ------------- | ---------------------------------------------------------------------------------------- |
| 0. Technical foundation  | **Current**   | App builds; docs and agent workflows match the repository.                               |
| 1. Deployment connection | **Planned**   | Local app reads/writes against the chosen Convex deployment.                             |
| 2. Product definition    | **Undecided** | Product brief and first vertical slice are approved.                                     |
| 3. First vertical slice  | **Undecided** | One real user outcome works end to end.                                                  |
| 4. Production hardening  | **Undecided** | Auth, tests, observability, accessibility, and release policy meet defined requirements. |

## Decisions required before domain work

| Decision                   | Why it matters                                              | Status        |
| -------------------------- | ----------------------------------------------------------- | ------------- |
| Primary user and problem   | Determines routes, language, and success metrics.           | **Undecided** |
| Core workflow              | Determines the first end-to-end feature slice.              | **Undecided** |
| Data ownership and privacy | Determines schema, auth, retention, and access rules.       | **Undecided** |
| Authentication provider    | Determines identity integration and protected-route design. | **Undecided** |
| Brand and visual direction | Determines whether the splash palette remains.              | **Undecided** |
| Production host/project    | Determines environment management and release ownership.    | **Undecided** |

When one of these becomes decided, update this page, the affected architecture/operations pages, and add an ADR when the decision has durable technical consequences.
