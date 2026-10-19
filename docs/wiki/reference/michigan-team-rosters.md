# Michigan basketball and hockey rosters

[Reference index](README.md) · [Wiki home](../README.md)

**Current source:** men’s basketball and men’s hockey have independent season rosters populated through owner saves and the reviewed imports recorded below. New seasons start empty. Public routes `/michigan/basketball` and `/michigan/hockey` now default to [season home pages](michigan-season-home.md), with full rosters under `view=roster`; owner routes are `/admin/roster/basketball` and `/admin/roster/hockey`.

The season key is the starting year: `2026` displays as `2026–27`. Switching seasons does not copy players or statistics. These rosters do not yet provide automatic rollover, player career profiles, recruiting history, game logs, or external imports.

## Editing

Use the existing owner login on desktop. Each team has a searchable spreadsheet with frozen names and headings, add-player rows, highlighted changes, batch save/discard, Tab across columns, Enter down columns, and Ctrl/Cmd-S to save. Leaving a dirty sheet prompts before discarding edits; changing seasons is disabled until saved or discarded. Failed saves retain the draft. Mark a player Departed to omit them from the public season roster; the admin retains their record.

Shared fields include name, jersey, class (FR/SO/JR/SR/5TH/GR), status, measurements, hometown, previous school/team, recruiting rank/rating, games played, and starts. Recruiting rating uses 0–1; it is an owner-entered value, without an inferred provider. Blank numbers remain unknown, separate from confirmed zero.

For screenshot entry, the owner's class convention advances redshirt labels one year: R-Fr. → SO, R-So. → JR, R-Jr. → SR, and R-Sr. → 5TH. Preserve the exact source label in the import artifact. Ordinary classes and graduate labels retain their direct mappings. This is an entry convention, not automatic conversion by the roster editor.

Basketball adds position, role, cumulative minutes/points/rebounds/assists/steals/blocks/turnovers, and FG/3P/FT percentages on a 0–100 scale. The public screen groups guards, wings/forwards, and centers. MPG/PPG/RPG/APG divide saved totals by games played; zero or unknown games produce unknown averages.

Hockey adds position, handedness, line/pair, goals, assists, shots, and penalty minutes. Goalies additionally have minutes, saves, goals against, wins, and shutouts. Goalie statistics require position G. Public tables separate forwards, defensemen, and goalies. Skater points equal goals plus assists; goalie SV% is saves divided by saves plus goals against (displayed as `.900`), and GAA is goals against times 60 divided by minutes. Missing inputs remain unknown. Players without a position appear in Unassigned.

## Persistence and isolation

`teamRosters.list` reads the sport/season index, bounded at 101 documents; writes enforce a maximum of 100 entries per team season. `teamRosters.save` validates the existing owner session, sport-specific column whitelist/options/ranges, player membership, and expected sport/season revision. Each atomic save advances `teamRosterRevisions`, updates owner-session activity, and records a receipt in `teamRosterAudit`. A stale edit is rejected; discard the draft to reload before editing again.

`teamRosterEntries.values` stores validated numbers, strings, or nulls. It is not an arbitrary stats bag: `teamRosterFields.ts` owns the supported fields and their validation. The editor sends complete rows under a version check. All stored fields are public roster facts; do not enter private owner notes.

Football identities, eligibility, participation, imports, rating inputs, and Michigan revision remain independent. The owner’s existing Michigan JSON backup/export and restore tooling cover **football only**. Full Convex deployment exports include the three new team tables. See [ADR 0014](../decisions/0014-isolate-additional-sport-rosters.md).

## Production hockey roster — 2026-10-18

**Hosted current:** production `doting-chipmunk-7` has all 27 players from the owner's two 2026–27 roster screenshots: 14 forwards, 10 defensemen, and three goalies. The owner-authorized save advanced hockey season `2026` from revision 1 to 2, adding Brandt Harper, Aidan Park, Miles Gust, Josh Orrico, and Kieren Dervin to the 22 existing players. It corrected Landon DuPont's capitalization, Drew Schock's hometown abbreviation, and Julian Molinaro's previous-team name. Existing statistics, lines/pairs, and specific C/LW/RW positions were preserved; new players' statistics remain unknown. All 27 saved rows were read-back verified, and the basketball roster was unchanged.

The current column whitelist has no NHL affiliation field. Those screenshot values were preserved in the operator's `C:/Users/choug/.t3/artifacts/michigan-hockey-2026-27/roster.csv`, rather than discarded or inserted into an unrelated field. No application code deployment was needed. The full pre-import export `production-before-hockey-roster-20261018.zip` and before/after hockey JSON snapshots are retained outside Git in `C:/Users/choug/Documents/cfb26-backups`.

## Production basketball roster — 2026-10-18

**Hosted current:** production `doting-chipmunk-7` has all 17 players from the owner's 2026–27 basketball roster screenshot: nine guards, six forwards, and two centers. The owner-authorized save populated the empty season `2026` roster and advanced its revision from 0 to 1. Names, jersey numbers, classes, positions, and hometowns were transcribed; `5th` maps to `5TH` and `Gr.` maps to `GR`. Players are Active, while measurements, recruiting values, previous teams, roles, and statistics remain unknown. All 17 saved rows were read-back verified, and the hockey roster was unchanged.

The source transcription is retained outside Git at `C:/Users/choug/.t3/artifacts/michigan-basketball-2026-27/roster.csv`. The full pre-import export `production-before-basketball-roster-20261018.zip` and before/after basketball JSON snapshots are retained in `C:/Users/choug/Documents/cfb26-backups`. No application code deployment was needed.

## Production 2025–26 basketball roster — 2026-10-18

**Hosted current:** production `doting-chipmunk-7` has all 16 players from the owner's 2025–26 screenshot under season `2025`, revision 1. Names, jerseys, classes, positions (including G/F), and hometowns were entered into the previously empty roster and read-back verified. Players are Active for that season; fields absent from the screenshot remain unknown. The 2026–27 basketball and hockey rosters were verified unchanged.

Oscar Goodman's source class is `R-Fr.`. His initial import used `FR`; production was subsequently corrected to `SO` under the owner's redshirt convention and verified during the 2023–24 import. The exact source class is retained in `C:/Users/choug/.t3/artifacts/michigan-basketball-2025-26/roster.csv`. The pre-import full export `production-before-basketball-2025-roster-20261018.zip` and before/after season snapshots are retained outside Git in `C:/Users/choug/Documents/cfb26-backups`. No application code deployment was needed.

## Production 2024–25 basketball roster — 2026-10-18

**Hosted current:** production `doting-chipmunk-7` has all 16 players from the owner's 2024–25 screenshot under season `2024`, revision 1. Names, jerseys, classes, positions (including F/C), heights in inches, weights in pounds, and hometowns were entered and read-back verified. The screenshot's listed schools use the existing Previous school / team field; no college transfer history was inferred. Players are Active for that season, and unprovided statistics remain unknown. The 2025–26 and 2026–27 basketball rosters and the 2026–27 hockey roster were verified unchanged.

Will Tschetter's source class is `R-Jr.`. His initial import used `JR`; production was subsequently corrected to `SR` under the owner's redshirt convention and verified during the 2023–24 import. The exact source label and school text are retained in `C:/Users/choug/.t3/artifacts/michigan-basketball-2024-25/roster.csv`. The full pre-import export `production-before-basketball-2024-roster-20261018.zip` and before/after season snapshots are retained outside Git in `C:/Users/choug/Documents/cfb26-backups`. No application code deployment was needed.

## Production 2023–24 basketball roster — 2026-10-18

**Hosted current:** production `doting-chipmunk-7` has all 15 players from the owner's 2023–24 screenshot under season `2023`, revision 1. Names, jerseys, classes, positions, heights, weights, hometowns, and listed schools were entered and read-back verified. Will Tschetter's `R-So.` maps to `JR` under the owner's convention. Unprovided statistics remain unknown. The 2024–25, 2025–26, and 2026–27 basketball rosters and the 2026–27 hockey roster were verified unchanged by this import; the two earlier class corrections were already present before it ran.

The source transcription is retained at `C:/Users/choug/.t3/artifacts/michigan-basketball-2023-24/roster.csv`. The full pre-import export `production-before-basketball-2023-roster-20261018.zip` and before/after roster snapshots are retained outside Git in `C:/Users/choug/Documents/cfb26-backups`. No application code deployment was needed.

## Production 2022–23 basketball roster — 2026-10-18

**Hosted current:** production `doting-chipmunk-7` has all 16 players from the owner's 2022–23 screenshot under season `2022`, revision 1. Names, jerseys, classes, positions, heights, weights, hometowns, and listed schools were entered and read-back verified. Isaiah Barnes and Will Tschetter map from `R-Fr.` to `SO` under the owner's convention. Players are Active for that season; unprovided statistics remain unknown. Basketball seasons 2023–2026 and hockey season 2026 were verified unchanged.

The exact source classes and transcription are retained at `C:/Users/choug/.t3/artifacts/michigan-basketball-2022-23/roster.csv`. The full pre-import export `production-before-basketball-2022-roster-20261018.zip` and before/after roster snapshots are retained outside Git in `C:/Users/choug/Documents/cfb26-backups`. No application code deployment was needed.

## Production 2021–22 basketball roster — 2026-10-18

**Hosted current:** production `doting-chipmunk-7` has all 16 players from the owner's 2021–22 screenshot under season `2021`, revision 1. Names, jerseys, classes, positions (including G/F), heights, weights, hometowns, and listed schools were entered and read-back verified. Classes follow the screenshot directly; no redshirt labels occur in this source. Players are Active for that season; unprovided statistics remain unknown. Basketball seasons 2022–2026 and hockey season 2026 were verified unchanged.

The source transcription is retained at `C:/Users/choug/.t3/artifacts/michigan-basketball-2021-22/roster.csv`. The full pre-import export `production-before-basketball-2021-roster-20261018.zip` and before/after roster snapshots are retained outside Git in `C:/Users/choug/Documents/cfb26-backups`. No application code deployment was needed.

## Production 2020–21 basketball roster — 2026-10-18

**Hosted current:** production `doting-chipmunk-7` has all 17 players from the owner's 2020–21 screenshot under season `2020`, revision 1. Names, jerseys, classes, positions, heights, weights, hometowns, and listed schools were entered and read-back verified. Classes map directly from this screenshot; it contains no redshirt labels. Players are Active for that season; unprovided statistics remain unknown. Basketball seasons 2021–2026 and hockey season 2026 were verified unchanged.

The source transcription is retained at `C:/Users/choug/.t3/artifacts/michigan-basketball-2020-21/roster.csv`. The full pre-import export `production-before-basketball-2020-roster-20261018.zip` and before/after roster snapshots are retained outside Git in `C:/Users/choug/Documents/cfb26-backups`. No application code deployment was needed.

## Production 2019–20 basketball roster — 2026-10-18

**Hosted current:** production `doting-chipmunk-7` has all 16 players from the owner's 2019–20 screenshot under season `2019`, revision 1. Names, jerseys, classes, positions, heights, weights, hometowns, and listed schools were entered and read-back verified. Classes map directly from this screenshot; it contains no redshirt labels. Players are Active for that season; unprovided statistics remain unknown. Basketball seasons 2020–2026 and hockey season 2026 were verified unchanged.

The source transcription is retained at `C:/Users/choug/.t3/artifacts/michigan-basketball-2019-20/roster.csv`. The full pre-import export `production-before-basketball-2019-roster-20261018.zip` and before/after roster snapshots are retained outside Git in `C:/Users/choug/Documents/cfb26-backups`. No application code deployment was needed.

## Production 2018–19 basketball roster — 2026-10-18

**Hosted current:** production `doting-chipmunk-7` has all 16 players from the owner's 2018–19 screenshot under season `2018`, revision 1. Names, jerseys, classes, positions, heights, weights, hometowns, and listed schools were entered and read-back verified. Classes map directly from this screenshot; it contains no redshirt labels. Players are Active for that season; unprovided statistics remain unknown. Basketball seasons 2019–2026 and hockey season 2026 were verified unchanged.

The source transcription is retained at `C:/Users/choug/.t3/artifacts/michigan-basketball-2018-19/roster.csv`. The full pre-import export `production-before-basketball-2018-roster-20261018.zip` and before/after roster snapshots are retained outside Git in `C:/Users/choug/Documents/cfb26-backups`. No application code deployment was needed.

## Production 2017–18 basketball roster — 2026-10-18

**Hosted current:** production `doting-chipmunk-7` has all 16 players from the owner's 2017–18 screenshot under season `2017`, revision 1. Names, jerseys, classes, positions (including G/F), heights, weights, hometowns, and listed schools were entered and read-back verified. Duncan Robinson's `5th` maps to `5TH`; other classes map directly from the screenshot. Players are Active for that season; unprovided statistics remain unknown. Basketball seasons 2018–2026 and hockey season 2026 were verified unchanged.

The source transcription is retained at `C:/Users/choug/.t3/artifacts/michigan-basketball-2017-18/roster.csv`. The full pre-import export `production-before-basketball-2017-roster-20261018.zip` and before/after roster snapshots are retained outside Git in `C:/Users/choug/Documents/cfb26-backups`. No application code deployment was needed.

## Production 2005–06 through 2016–17 basketball rosters — 2026-10-18

**Hosted current:** production `doting-chipmunk-7` has 185 player-season entries across all 12 seasons from 2005–06 through 2016–17. The owner authorized using the official Michigan Athletics roster pages, with URLs following `https://mgoblue.com/sports/mens-basketball/roster/<season>`; see the [2005–06 roster](https://mgoblue.com/sports/mens-basketball/roster/2005-06) and [2016–17 roster](https://mgoblue.com/sports/mens-basketball/roster/2016-17). Each requested page's season heading, table columns, player names against its roster list, unique names/jerseys, measurements, and supported class/position values were checked before import. These pages contain no redshirt labels; ordinary classes and `5th` map directly.

All 12 season rosters were empty before the import and now have revision 1. Verified counts by starting year: 2005: 17; 2006: 17; 2007: 14; 2008: 13; 2009: 17; 2010: 15; 2011: 16; 2012: 15; 2013: 15; 2014: 15; 2015: 15; 2016: 16. Every saved name, jersey, class, position, height, weight, hometown, and listed school was read-back verified. Players are Active for their season, and unprovided statistics remain unknown. Basketball seasons 2017–2026 and hockey season 2026 were verified unchanged.

Source HTML, per-season CSVs, the validated `import.json` with source URLs and SHA-256 hashes, and `receipt.json` are retained outside Git in `C:/Users/choug/.t3/artifacts/michigan-basketball-2005-2016`. The full pre-import export `production-before-basketball-2005-2016-rosters-20261018.zip` and before/after roster snapshots are retained in `C:/Users/choug/Documents/cfb26-backups`. This was an operator-run data import using the existing owner save API; no automatic ingestion feature or application code deployment was added.

## Production 2005–06 through 2025–26 hockey rosters — 2026-10-18

**Hosted current:** production `doting-chipmunk-7` has 561 player-season entries across all 21 seasons from 2005–06 through 2025–26, sourced from the official Michigan Athletics roster pages. URLs follow `https://mgoblue.com/sports/mens-ice-hockey/roster/<season>`; see the [2005–06 roster](https://mgoblue.com/sports/mens-ice-hockey/roster/2005-06) and [2025–26 roster](https://mgoblue.com/sports/mens-ice-hockey/roster/2025-26). All 21 rosters were empty before import and now have revision 1. Each requested page's season heading, table columns, player names against its roster list, unique names/jerseys, measurements, handedness, positions, and classes were validated. Every saved row was read-back verified. Hockey season 2026 and basketball seasons 2005–2026 were verified unchanged.

The import includes names, jerseys, classes, positions, shoots/catches, heights, weights, hometowns, and previous teams where listed. Roster list views supplied 31 previous-team values absent from the older tables. Where table/list school values differ, the table takes precedence; eight discrepancies are recorded in the import artifact. Missing previous teams and statistics remain unknown. Players are Active for their season.

Eight explicit redshirt labels use the owner's next-year mapping. Seven hybrid positions use the first-listed position because the current whitelist lacks D/F and F/D: David Rohlfs (2005), Eric Elmblad (2006), Chris Summers (2008), and Nick Blankenburg (2018) map D/F to D; Niko Porikos (2015–2017) maps F/D to F. Original class and position labels and NHL affiliations remain in the per-season CSVs; NHL affiliations are not stored in the database because no NHL field exists.

Source HTML, per-season CSVs, validated `import.json` with source URLs/hashes/mappings/discrepancies, and `receipt.json` with per-season counts are retained outside Git in `C:/Users/choug/.t3/artifacts/michigan-hockey-2005-2025`. The full pre-import export `production-before-hockey-2005-2025-rosters-20261018.zip` and before/after roster snapshots are retained in `C:/Users/choug/Documents/cfb26-backups`. No application code deployment or automatic ingestion feature was added.

## Production 2005–06 through 2025–26 basketball statistics — 2026-10-18

**Hosted current:** production `doting-chipmunk-7` has 308 player-season statistics records across all 21 seasons from 2005–06 through 2025–26. Source URLs use the ending year: the [2006 page](https://www.sports-reference.com/cbb/schools/michigan/men/2006.html) supplies season key `2005`, and the [2026 page](https://www.sports-reference.com/cbb/schools/michigan/men/2026.html) supplies key `2025`. The import uses each page's full-season player totals, excluding conference-only and per-game tables.

Imported fields are games, starts, cumulative minutes, points, rebounds, assists, steals, blocks, turnovers, and FG/3P/FT percentages. Source percentages were converted from 0–1 to the stored 0–100 scale; blank percentages remain null. Confirmed zeros remain zero, and roster players absent from the statistics table retain unknown statistics. Public per-game figures derive from the stored totals and games. Source hashes, exact field comparisons, point arithmetic, shooting ratios, and available offensive/defensive rebound splits were checked; all 308 saved records were read-back verified.

Three names were matched to existing roster names: Phillip DeVries → Phil DeVries (2006–07), Darrick Ervin → Darrick Ervin II (2010–11), and Chaundee Brown → Chaundee Brown Jr. (2020–21). Seven actual participants absent from the archived Michigan roster pages were added using the same season's Sports Reference roster facts: K'Len Morris and Jerret Smith (2007–08), Ben Cronin (2008–09), Jon Rubenstein and Ryan Kapustka (2014–15), Rico Ozuna-Harrison (2017–18), and Zeb Jackson (2021–22). Missing source facts remain unknown. Existing roster identities, classes, measurements, status, roles, and other non-statistical fields were preserved.

Basketball seasons 2005–2023 advanced to revision 2; seasons 2024–2025 advanced from revision 2 to 3. The 2026–27 basketball roster and all 22 hockey rosters were verified unchanged, as was football's data revision 61. This supplements the earlier roster-only import records above. No application code deployment was needed for the statistics saves.

Source HTML, per-season CSVs, `reviewed-stats-import.json`, `participant-audit.json`, and the final `receipt.json` are retained in `C:/Users/choug/.t3/artifacts/michigan-basketball-stats-2005-2025`. The verified full pre-import export `production-before-basketball-stats-2005-2025-20261018.zip` and before/after season snapshots are retained in `C:/Users/choug/Documents/cfb26-backups`.

## Production 2005–06 through 2026–27 hockey statistics — 2026-10-18

**Hosted current:** production `doting-chipmunk-7` has 565 player-season statistics records across all 22 seasons from 2005–06 through 2026–27, including 54 goaltending records within that count. Source URLs use consecutive full years: the [2005–06 page](https://www.collegehockeynews.com/stats/team/Michigan/31/overall,20052006) maps to season key `2005`, the [2025–26 page](https://www.collegehockeynews.com/stats/team/Michigan/31/overall,20252026) maps to `2025`, and the [2026–27 page](https://www.collegehockeynews.com/stats/team/Michigan/31/overall,20262027) maps to `2026`. The current season is a six-game snapshot, not a completed season. It refreshes the existing five-game totals for 20 players with changed published values; earlier owner line assignments and roster details are retained.

Imported core fields are games, goals, assists, shots, and penalty minutes, plus goalie minutes, saves, goals against, wins, and shutouts where published. Points remain derived from goals plus assists; goalie save percentage and GAA remain derived from saved totals. Starts and other unreported fields remain unchanged or unknown. Team totals and empty-net goals are not inserted as players or attributed to individual goalies. Players absent from the source retain their existing records and unreported fields; no zeros are inferred from absence. Existing names, classes, measurements, positions, status, previous teams, recruiting values, and line assignments were preserved.

Two reviewed aliases retain existing roster names: Jake Fallon → Jacob Fallon (2010–11), and Emil Öhrvall → Emil Öhrwall (2019–20). Four participants absent from the archived Michigan roster pages were added with source-confirmed names, jerseys, classes, and positions: Robbie Czarnik (2009–10), Daniel Milne (2012–13), Tim Lovell and Christian Humphreys (2024–25). Their Michigan participation and annual jersey details were corroborated through official Michigan profiles/game notes, retained in the identity audit. Their remaining roster facts stay unknown. There are now 592 hockey roster entries across seasons 2005–2026.

Source headings, SHA-256 hashes, player identity matches, point arithmetic, shooting/save ratios, goalie records, and all available team goals/assists/shots/save sums were validated. Every saved value was read-back verified, along with each original row's unmodified fields and all basketball rosters. Hockey seasons 2005–2025 advanced from revision 1 to 2; season 2026 advanced from revision 2 to 3. Football's data revision stayed 61. This import used the existing owner save API and required no application deployment; the separately prepared basketball/hockey schedule deployment remains pending approval.

CHN's scoring and goaltending tables disagree on goalie appearances for Jack Leavy in 2021–22 (3 versus 2) and Noah West in 2023–24 (7 versus 6). The goaltending table takes precedence for goalie GP; both source values remain in the audit. CHN publishes goalie minutes rounded to whole minutes. The app derives GAA from those published minutes, so it can differ from CHN's displayed GAA, especially for short appearances: Leavy's 2 GA and 12 published minutes yield 10.00 in the app versus CHN's 10.24. No exact seconds were invented. Source-displayed GAA/SV%, goalie losses/ties, power-play/shorthanded/game-winning goals, plus/minus, ice time, and CHIP remain in the source CSVs/JSON where published; fields without an app column were not inserted into another column.

Original HTML, player-profile checks, supported-field CSVs, full skater/goalie source CSVs, `reviewed-stats-import.json`, `participant-audit.json`, and the final `receipt.json` are retained outside Git in `C:/Users/choug/.t3/artifacts/michigan-hockey-stats-2005-2026`. The verified full pre-import export `production-before-hockey-stats-2005-2026-20261018.zip` and before/after roster snapshots are retained in `C:/Users/choug/Documents/cfb26-backups`. Documentation link checks cover this record; no application code changed for the statistics import.
