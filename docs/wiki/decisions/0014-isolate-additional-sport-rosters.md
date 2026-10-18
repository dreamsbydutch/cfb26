# ADR 0014: Isolate basketball and hockey season rosters

Status: Accepted

## Context

The owner requested men’s basketball and men’s hockey with empty editable rosters and sport-appropriate public tables. Football’s person/stint/season graph includes football eligibility, participation phases, external identities, and national rating inputs. Adding other sports to that graph would change many existing consumers without providing needed behavior for this request.

## Decision

Store the additional teams in indexed, sport-and-season-scoped `teamRosterEntries`, with independent revisions and audit receipts. Reuse owner authentication, shell, navigation protection, and spreadsheet interaction conventions. Share one validated column configuration across the new sports’ editor and backend; use distinct public metrics and position groups.

## Consequences

Football behavior and datasets retain their existing meaning. New team seasons are independent snapshots, not canonical cross-season player identities. Automatic rollover, linked career history, provider imports, and inclusion in the football-specific JSON backup are not implemented. Full deployment exports include these tables. A future identity/history extension should introduce explicit cross-season links rather than matching players by name.

[Decision index](README.md) · [Team roster contract](../reference/michigan-team-rosters.md)
