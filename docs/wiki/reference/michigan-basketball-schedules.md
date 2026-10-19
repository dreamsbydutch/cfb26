# Michigan basketball schedule and score history

[Reference index](README.md) · [Wiki home](../README.md)

**Current source:** `/michigan/basketball` includes Roster and Schedule & results views. `?season=2005&view=schedule` opens 2005–06. The season selector reaches 2005–06, and an opponent filter narrows the selected season. The shared `TeamSchedule.tsx` display also serves hockey, with independent sport queries and records.

Games display dates/date ranges, opponents and listed ranks, home/away/neutral designation, location, Michigan-first scores, W/L, overtime/tournament notes, and available box score/recap links. Exhibitions remain visible but are excluded from the displayed record. Cancellations, postponements, no-contests, and upcoming games retain separate states and unknown scores. Conditional postseason placeholders do not assert qualification. Times remain as published by Michigan Athletics.

Opponent filters group school-name variants and ignore source rank/seed labels for matching, while retaining the original game labels in the table. Shared source IDs for different tournament rounds remain separate filter choices. The same rule applies to hockey.

## Persistence and import

`basketballScheduleGames` and `basketballScheduleImports` are independent of hockey schedules, roster entries, player statistics, and football's Michigan revision and JSON backup contract. Both use `by_season` indexes. `basketballSchedules.list/importSeason` uses the same bounded, owner-authenticated, revision-checked official-ID reconciliation as [hockey schedules](michigan-hockey-schedules.md). Reads return at most 81 games; imports enforce 1–80. Repeated identical imports are no-ops; corrections retain game IDs, and previously recorded games cannot silently disappear.

`teamScheduleFields.ts` shares calendar, paired-score, result, link, and size validation. Basketball allows whole-number scores up to 300 and rejects ties; hockey retains its 100-goal limit and official ties. No game result is inferred from today's date or a generic source game-state marker when explicit results are available.

The shared `scripts/import-team-schedules.mjs` takes an explicit sport flag and verifies that each source URL belongs to that sport and season. It validates every input season and source HTML hash before writing, backs up the target schedules plus all basketball/hockey roster snapshots, imports one season at a time, and verifies every saved field. Final checks compare all rosters, the other sport's schedules, and football's revision. `scripts/import-hockey-schedules.mjs` retains the original hockey command as a compatibility entry point. Use a full Convex export for complete deployment recovery.

```powershell
# Owner token belongs in CFB26_OWNER_SESSION, never command arguments or files.
# Apply additionally requires CFB26_BACKUP_DIRECTORY outside the repository.
node --experimental-strip-types scripts/import-team-schedules.mjs <reviewed-import.json> <https://deployment.convex.cloud> --sport=basketball

# After exact-target authorization and a fresh full deployment export:
node --experimental-strip-types scripts/import-team-schedules.mjs <reviewed-import.json> <https://deployment.convex.cloud> --sport=basketball --apply
```

## Prepared 2005–06 through 2026–27 archive

**Imported source archive:** all 22 official pages yielded 816 schedule entries: 760 finals, 40 upcoming entries, seven cancellations, and nine postponements. Across those states, 29 entries are exhibitions. Source URLs run from the [2005–06 schedule](https://mgoblue.com/sports/mens-basketball/schedule/2005-06) to the [2026–27 schedule](https://mgoblue.com/sports/mens-basketball/schedule/2026-27). The latest season includes completed exhibitions and future regular-season fixtures; it is not a completed season.

Extraction uses only the requested season's structured schedule and avoids the site's global event widgets. Explicit W/L and scores override stale `PREGAME`/`SCHEDULED` markers; cancellation/postponement notes override generic completed markers. Source HTML, decoded schedules, CSVs, hashes, reviewed input, extraction scripts, and record audit are retained outside Git at `C:/Users/choug/.t3/artifacts/michigan-basketball-schedules-2005-2026`. Full deployment exports, before/after snapshots, and receipts are retained in `C:/Users/choug/Documents/cfb26-backups`.

**Hosted development verified:** `adjoining-opossum-710` contains all 816 entries, with every season at revision 1. Every saved field was read-back verified. The 21 completed-season W–L records match the official pages' published records. The 2026–27 page has no published regular-season record yet and contains only completed exhibitions and future fixtures; its derived regular-season record is 0–0. `record-audit.json` retains these distinctions. All hockey schedules and basketball/hockey roster snapshots were unchanged, and football's development revision remained 4. The receipt is `basketball-schedules-receipt-1792378039958.json`. Production `doting-chipmunk-7` now also contains all 816 entries at revision 1 for every season. The production receipt is `basketball-schedules-receipt-1792379819569.json`; every saved field was verified, with all rosters, the other sport's schedules, and football revision 61 unchanged.

`npm run check` passed 212 Node tests, 28 Convex tests, strict TypeScript, ESLint, 142 Markdown link checks, and the production build. The additional opponent-filter test passed separately after it was added, as did the final TypeScript check. Schedule tests cover owner authorization, sport/season isolation, stale revisions, repeat imports, identity-preserving corrections, no silent deletions, unplayed states, and the different score/tie rules. Browser-based visual verification remains unavailable because no browser connection is exposed in this session.

**Release verification (2026-10-18):** `npm run check` passed 215 Node tests, 28 Convex tests, TypeScript, ESLint, maintained Markdown links, and the production build. The development backend was synchronized again before production promotion. Browser visual checks remain unavailable.
