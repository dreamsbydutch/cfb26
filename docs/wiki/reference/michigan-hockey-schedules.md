# Michigan hockey schedule and score history

[Reference index](README.md) · [Wiki home](../README.md)

**Current source:** `/michigan/hockey` includes Roster and Schedule & results views. The season selector reaches 2005–06; `?season=2005&view=schedule` opens that season's game history. An opponent filter narrows the selected season. The basketball roster selector also reaches its imported 2005–06 roster. Changing seasons does not copy games or players.

The schedule displays calendar dates and date ranges, opponents and listed ranks, home/away/neutral designation, location, Michigan-first scores, W/L/T, time as published, tournament notes, and available box score/recap links. Exhibitions remain visible but do not count toward the displayed record. Shootout wins/losses remain in notes; an official tie stays a tie. Cancellations, postponements, no-contests, upcoming games, and finals without a published score retain their distinct states. Missing scores remain unknown. Conditional postseason placeholders are retained exactly as scheduled; they do not assert tournament qualification.

**Current presentation:** dense schedule rows keep opponent and result prominent. The table sizes to its content rather than filling the screen; its section is capped at the available width and scrolls horizontally on narrow screens. Location and tournament are visible in the Location / event column, with box-score and recap links alongside in the Links column. There is no per-game Details toggle; brief schedule conventions expand below the table. Routine source links and import timestamps stay internal.

The [season home page](michigan-season-home.md) also embeds the complete schedule below the season summary, player contributions, and postseason results. Existing `view=schedule` links continue to open the dedicated schedule.

## Storage and import

`hockeyScheduleGames` stores one Michigan game observation per official game ID and season. `hockeyScheduleImports` appends the source URL/hash, count, revision, import time, and owner-session receipt. Both tables use `by_season` indexes. `hockeySchedules.list` returns at most 81 rows for a season; imports enforce a maximum of 80. Source and import dates remain in the data contract but are omitted from the public display. Empty seasons show an empty state.

`hockeySchedules.importSeason` requires an owner session and expected season revision. It validates unique official IDs, calendar dates within the July–June season, paired nonnegative scores, consistent W/L/T, HTTPS links, and scoreless unplayed states. A repeated identical import is a no-op. Corrections update existing IDs. Imports cannot silently remove previously recorded games. An invalid row aborts the batch. These tables are isolated from roster/player statistics and football's Michigan data revision and JSON backup contract. Use a full Convex export for complete deployment recovery.

`scripts/import-hockey-schedules.mjs` retains the original hockey command through the shared `scripts/import-team-schedules.mjs` runner, which defaults to hockey. It validates all reviewed seasons and HTML hashes before writes, snapshots existing schedules and all basketball/hockey rosters outside Git, applies one season at a time, verifies every saved field, and writes receipts. It checks roster isolation, the other sport's schedules, and football's unchanged revision after the complete run. Credentials are supplied only through `CFB26_OWNER_SESSION`; `CFB26_BACKUP_DIRECTORY` must be outside the repository. Obtain exact-target deployment/import authorization and a fresh full deployment export first.

```powershell
# Read-only preparation; reviewed HTML must accompany the JSON by starting year.
node --experimental-strip-types scripts/import-hockey-schedules.mjs <reviewed-import.json> <https://deployment.convex.cloud>

# Apply only to the approved target.
node --experimental-strip-types scripts/import-hockey-schedules.mjs <reviewed-import.json> <https://deployment.convex.cloud> --apply
```

## Prepared 2005–06 through 2026–27 archive

**Imported source archive:** all 22 requested Michigan Athletics pages yielded 912 schedule entries: 867 finals (including exhibitions and score-unavailable intrasquad events), 34 scheduled entries, six cancellations, four postponements, and one no-contest. There are 43 exhibitions across those states. Source URLs run from the [2005–06 schedule](https://mgoblue.com/sports/mens-ice-hockey/schedule/2005-06) to the [2026–27 schedule](https://mgoblue.com/sports/mens-ice-hockey/schedule/2026-27). The 2026–27 page includes games played through October 17, 2026 and future fixtures; it is not a completed season.

Extraction reads only the requested season's structured schedule, avoiding the site's global recent/upcoming event widgets. Explicit W/L/T and scores take precedence over a stale `SCHEDULED` game-state field. Cancellation/postponement/no-contest text takes precedence over a generic completed state. Original HTML, decoded source schedules, per-season CSVs, source hashes, reviewed input, and extraction scripts are retained outside Git at `C:/Users/choug/.t3/artifacts/michigan-hockey-schedules-2005-2026`. Deployment backups, before/after snapshots, and import receipts are retained at `C:/Users/choug/Documents/cfb26-backups`.

**Hosted development verified:** the backend is deployed to `adjoining-opossum-710`. The complete 912-entry, 22-season import passed live read-back verification, advancing each schedule to revision 1. All 22 derived W–L–T records match the corresponding official page's published overall record; `record-audit.json` retains this comparison. All basketball/hockey roster snapshots and football's development revision 4 remained unchanged. The development receipt is `hockey-schedules-receipt-1792377246355.json`. Production `doting-chipmunk-7` now also contains all 912 entries at revision 1 for every season. The production receipt is `hockey-schedules-receipt-1792379801287.json`; every saved field was verified, with all rosters, the other sport's schedules, and football revision 61 unchanged.

Verification passed 212 Node tests, 25 Convex tests, strict TypeScript, ESLint, 141 Markdown link checks, and the production build. The four schedule tests cover owner authorization, revision conflicts, idempotency, identity-preserving corrections, no silent deletions, sport/season isolation, score/date validation, ties, and unplayed states. Browser-based visual verification was unavailable because no browser connection was exposed in this workspace.

**Release verification (2026-10-18):** `npm run check` passed 215 Node tests, 28 Convex tests, TypeScript, ESLint, maintained Markdown links, and the production build. The development backend was synchronized again before production promotion. Browser visual checks remain unavailable.

**NPI:** from 2025-26, the schedule shows [current or final NPI](michigan-hockey-npi.md). Current rankings refresh weekly and replace the saved table; past seasons retain only final rankings. Michigan Athletics listed poll ranks are discarded during imports and removed from saved opponent names; the shared legacy prefix field remains empty for hockey. Seasons before NPI have no ranking indicator.

**Poll-label cleanup — 2026-10-19:** development and production removed 342 listed opponent poll labels across all 22 seasons. All 912 games were read-back verified with identities and every non-ranking game field preserved; basketball schedules and current NPI were unchanged. The verified full production snapshot `production-before-hockey-poll-cleanup-20261019.zip` is retained in `C:/Users/choug/Documents/cfb26-backups`; per-environment receipts and schedule snapshots are retained outside Git under `C:/Users/choug/.t3/artifacts/hockey-poll-cleanup-20261019`. Both the owner import endpoint and CLI discard these labels on future imports.
