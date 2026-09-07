# Team-level historical data

[Reference index](README.md) · [Wiki home](../README.md)

## Authority and scope

**Current source:** national college data comes directly from CollegeFootballData (CFBD). CFB26 normalizes only what is required for stable identity, rendering, historical calculations, and frozen outputs; it is not a raw mirror. OpenSheet is no longer an ingestion dependency.

| Data                                                     | Retention                             |
| -------------------------------------------------------- | ------------------------------------- |
| Programs, aliases, affiliations, venues                  | Permanent historical identity/context |
| Compact schedules/results                                | 2000 onward, permanent                |
| Power/Résumé editions                                    | 2015 onward, permanent                |
| Frozen forecasts, playoff projections, submitted ballots | Permanent                             |
| Detailed team-game features                              | Rolling five seasons                  |
| Raw responses/import payloads                            | Transient; not stored                 |
| Latest sync state                                        | Overwritten                           |

## Identity

`programs` owns the canonical key and current display facts. `programAliases` maps provider keys/names explicitly. `programAffiliations` and `programVenues` use seasonal intervals so a later conference, name, or venue change does not rewrite history. Unknown or conflicting provider identities are rejected or queued rather than guessed.

## Synchronization

`teamData` and `games` use the validated `cfbdClient` boundary. Each job:

1. records a running source state;
2. validates response and row identity;
3. upserts in bounded idempotent batches;
4. records accepted/rejected counts and warnings; and
5. records failure without emptying the prior valid tables.

Core game failure blocks official rating publication. Recruiting, talent, returning production, draft, poll, venue, and media failures degrade visibly but do not destroy core availability. Scheduled pruning touches only detailed national feature rows older than the retained window.

## Public joins

Program profiles join current identity to season-specific profile, affiliation, venue, schedule, rating, recruiting/talent context, and recent draft production. Schedule and Résumé evidence use the selected rating edition cutoff; past opponents may be reclassified by that edition, but later outcomes cannot leak backward.

Historical provider limitations remain evidence-quality limitations. A missing optional source field is shown as unavailable, never synthesized as a zero or a favorable signal.
