# Michigan basketball and hockey rosters

[Reference index](README.md) · [Wiki home](../README.md)

**Current source:** men’s basketball and men’s hockey have independent, initially empty season rosters. No researched, sample, or inferred players are inserted. Public routes are `/michigan/basketball` and `/michigan/hockey`; owner routes are `/admin/roster/basketball` and `/admin/roster/hockey`.

The season key is the starting year: `2026` displays as `2026–27`. Switching seasons does not copy players or statistics. These rosters do not yet provide automatic rollover, player career profiles, recruiting history, game logs, or external imports.

## Editing

Use the existing owner login on desktop. Each team has a searchable spreadsheet with frozen names and headings, add-player rows, highlighted changes, batch save/discard, Tab across columns, Enter down columns, and Ctrl/Cmd-S to save. Leaving a dirty sheet prompts before discarding edits; changing seasons is disabled until saved or discarded. Failed saves retain the draft. Mark a player Departed to omit them from the public season roster; the admin retains their record.

Shared fields include name, jersey, class (FR/SO/JR/SR/5TH/GR), status, measurements, hometown, previous school/team, recruiting rank/rating, games played, and starts. Recruiting rating uses 0–1; it is an owner-entered value, without an inferred provider. Blank numbers remain unknown, separate from confirmed zero.

Basketball adds position, role, cumulative minutes/points/rebounds/assists/steals/blocks/turnovers, and FG/3P/FT percentages on a 0–100 scale. The public screen groups guards, wings/forwards, and centers. MPG/PPG/RPG/APG divide saved totals by games played; zero or unknown games produce unknown averages.

Hockey adds position, handedness, line/pair, goals, assists, shots, and penalty minutes. Goalies additionally have minutes, saves, goals against, wins, and shutouts. Goalie statistics require position G. Public tables separate forwards, defensemen, and goalies. Skater points equal goals plus assists; goalie SV% is saves divided by saves plus goals against (displayed as `.900`), and GAA is goals against times 60 divided by minutes. Missing inputs remain unknown. Players without a position appear in Unassigned.

## Persistence and isolation

`teamRosters.list` reads the sport/season index, bounded at 101 documents; writes enforce a maximum of 100 entries per team season. `teamRosters.save` validates the existing owner session, sport-specific column whitelist/options/ranges, player membership, and expected sport/season revision. Each atomic save advances `teamRosterRevisions`, updates owner-session activity, and records a receipt in `teamRosterAudit`. A stale edit is rejected; discard the draft to reload before editing again.

`teamRosterEntries.values` stores validated numbers, strings, or nulls. It is not an arbitrary stats bag: `teamRosterFields.ts` owns the supported fields and their validation. The editor sends complete rows under a version check. All stored fields are public roster facts; do not enter private owner notes.

Football identities, eligibility, participation, imports, rating inputs, and Michigan revision remain independent. The owner’s existing Michigan JSON backup/export and restore tooling cover **football only**. Full Convex deployment exports include the three new team tables. See [ADR 0014](../decisions/0014-isolate-additional-sport-rosters.md).
