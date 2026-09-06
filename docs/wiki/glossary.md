# Glossary

[Wiki home](README.md)

| Term               | Meaning in this repository                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Action             | A Convex server function for external/non-transactional work; it may orchestrate queries and mutations.                                        |
| ADR                | Architecture decision record under `docs/wiki/decisions/`.                                                                                     |
| Affiliation        | A program's season-bounded conference or independent membership; it is historical, not one permanent program field.                            |
| CFB26 Player Grade | The owner's subjective 0–100 one-decimal evaluation of one player's offense, defense, or special-teams performance in one Michigan game.       |
| CFB26 Power        | The predictive system answering how strong a team is and what should happen in a future matchup.                                               |
| CFB26 Résumé       | The merit system answering what a team has earned through a selected cutoff; public editions begin in Week 7.                                  |
| Commitment         | A person's declared intention to join Michigan; it is distinct from enrollment and may end in a decommitment.                                  |
| Composite rating   | The superseded 0–100 percentile model retained only as a migration fallback.                                                                   |
| Convex deployment  | A selected Convex backend environment with functions, data, and environment variables.                                                         |
| Coverage state     | Whether a source value is known, explicitly zero, unknown, or absent; it must not be inferred from a numeric default.                          |
| Edition            | An immutable, cutoff-specific publication of ratings and supporting evidence under explicit model/source versions.                             |
| Enrollment         | The event that changes an incoming person from prospect to Michigan roster eligibility; it is not implied by commitment.                       |
| Evaluation Event   | A dated, repeatable recruiting, transfer, draft, or owner evaluation with its provider, scale, score/rank, and direction.                      |
| Foundation         | The stack, documentation, and workflow established before the Michigan personnel vertical replaced the original sample UI.                     |
| Frozen forecast    | A prospective prediction persisted before kickoff with its edition/model/venue inputs; later research does not replace it.                     |
| Generated file     | Tool-owned output such as `src/routeTree.gen.ts` or `convex/_generated/`; source changes must be made elsewhere.                               |
| Michigan stint     | One continuous enrolled tenure at Michigan; one Person may have more than one stint.                                                           |
| Mutation           | A transactional Convex function that may read and write database state.                                                                        |
| Official edition   | The published edition for a cutoff. A correction creates an amendment rather than overwriting it.                                              |
| Person             | One canonical human identity spanning commitments, one or more Michigan stints, draft/UDFA entry, and NFL identities.                          |
| Player Game        | The optional one-person/one-Michigan-game record containing independent phase participation, snaps, grades, and conventional statistics.       |
| Player Season      | One person's season-specific Michigan football state within one Michigan stint.                                                                |
| Position room      | A derived roster grouping; it does not replace the exact position listed for a Player Season.                                                  |
| Program            | One canonical college football team identity across provider aliases, name changes, affiliations, and venues.                                  |
| Quadrant           | A completed FBS opponent class derived from the selected edition's Power order: Q1 1–35, Q2 36–70, Q3 71–105, or Q4 106–last.                  |
| Query              | A reactive Convex read function with no database writes.                                                                                       |
| Reconstruction     | A historical rating or forecast artifact calculated later and explicitly not represented as a publication that existed at the original cutoff. |
| Route tree         | TanStack Router's generated typed registry of files under `src/routes/`.                                                                       |
| Skill              | A task-specific agent workflow under `.agents/skills/<name>/SKILL.md`, selected by its metadata.                                               |
| Source authority   | The provider or owner whose fact wins within an assigned domain; authority differs from mere provenance.                                       |
| Unresolved match   | A provider record that cannot be linked to a canonical identity safely and awaits owner review.                                                |
| Vertical slice     | One useful user outcome implemented across backend, UI, states, documentation, and verification.                                               |
| Wiki               | The detailed durable documentation rooted at `docs/wiki/README.md`.                                                                            |
