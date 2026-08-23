# Architecture decisions

Architectural decision records explain durable choices and their consequences. Operational instructions belong elsewhere in the wiki.

| ADR                                                        | Status   | Decision                                                                         |
| ---------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| [0001](0001-tanstack-start-and-convex.md)                  | Accepted | Use TanStack Start for the React app and Convex for the backend.                 |
| [0002](0002-tiered-college-game-retention.md)              | Accepted | Keep compact long-range games and only five seasons of detailed team stats.      |
| [0003](0003-separate-team-strength-and-game-importance.md) | Accepted | Keep team strength separate from national and Michigan game importance.          |
| [0004](0004-versioned-multi-perspective-team-rating.md)    | Accepted | Normalize evidence into a versioned, multi-perspective rating and matchup model. |
| [0005](0005-single-owner-roster-admin-key.md)              | Accepted | Gate narrow roster edits with a deployment-only single-owner secret.             |

## Adding an ADR

Use the next four-digit number. Record the context, decision, consequences, and status. Do not rewrite accepted history when a decision changes; supersede it with a new ADR and link both records.

[Back to wiki home](../README.md)
