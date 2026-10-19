# Official Michigan football roster reconciliation

[Guides](README.md) · [Wiki home](../README.md)

**Hosted current (2026-10-18):** `officialFootballRosters.preview/apply` reconciles reviewed Michigan Athletics roster observations for seasons 2005–2026 into the existing football Person, Roster Stint, and Player Season model. The backend is deployed to development `adjoining-opossum-710` and production `doting-chipmunk-7`; Vercel project `cfb` serves the updated 2005-onward public and owner season controls at [the production site](https://cfb-hazel.vercel.app). This operator workflow is separate from the independent basketball/hockey tables.

## Source and identity review

Fetch each requested `https://mgoblue.com/sports/football/roster/<year>` page, retain its HTML and SHA-256 outside Git, and check its season heading, roster table, and player names against the roster list. Football jersey numbers are not unique identities. Preserve missing measurements and ambiguous jersey labels as null; do not extract a guessed number from `20/TBD`.

Use stable, reviewed identity keys across seasons and explicit existing player IDs for aliases. Separate namesakes by school and era: the 2005–2008 Will Johnson from Lake Orion is distinct from the 2022–2024 Will Johnson from Grosse Pointe South. Retain canonical owner names and existing player IDs. Review new people against the complete exported player table, not the bounded search catalog. The 2009 Rusheed Furrha and 2010 Rasheed Furrha profiles describe the same player; their prep history and personal biography corroborate that alias.

Map ordinary classes directly and explicit redshirt labels one year forward: R-Fr. → SO, R-So. → JR, R-Jr. → SR, R-Sr. → 5TH. `Gr.` stays GR. A listed class does not prove an enrollment date, competition season, scholarship, transfer, or eligibility extension.

## Safeguards and retained fields

Preview and apply require an owner session. A batch contains 1–160 rows for one season. Apply requires the current Michigan revision, an exact-revision backup manifest, and the preview fingerprint for the same reviewed rows. An invalid row aborts the transaction. Reads use bounded indexes. Every successful batch advances Michigan's revision and appends an owner audit receipt containing its source hash.

Existing identities, names, entry/lifecycle history, nonblank hometown/school facts, evaluations, movements, game logs, participation, eligibility, roles, availability, and scholarship facts are preserved. Existing owner-verified annual measurements, jersey, position, and listed class take precedence; missing measurements may be filled. Source-verified annual roster facts may be refreshed, while a more precise position within the same room is retained when the official position is broad. Players absent from a source page are not deleted or marked departed.

New identities use `entryMethod: legacy`, their first observed Michigan season, and `needs_review`: first observed is not asserted to be their first college enrollment. New annual records retain an optional `listedClass`, have no inferred eligibility evidence, and carry `rosterOnly: true`. Required legacy counters initialize to zero, but public roster/lineup GP displays unknown for these roster-only observations unless a participation snapshot supplies GP. Explicit owner GP/starts edits clear `rosterOnly`. Existing eligibility calculations remain independent of the displayed listed class. Retrospective stints do not create invented arrival/transfer movement events.

## Run the reviewed import

The input is an object with a `seasons` array. Each season provides `season`, `sourceSha256`, and `rows` matching the server validator in `convex/officialFootballRosters.ts`. Source/profile URLs must belong to Michigan Athletics. Keep credentials in the environment, never arguments or files. Set `CFB26_OWNER_SESSION`; apply also requires an existing `CFB26_BACKUP_DIRECTORY` outside the repository.

```powershell
# Read-only preview of all reviewed seasons
node --experimental-strip-types scripts/import-official-football.mjs <reviewed-import.json> <https://deployment.convex.cloud>

# Run only after exact-target authorization and a fresh full deployment export
node --experimental-strip-types scripts/import-official-football.mjs <reviewed-import.json> <https://deployment.convex.cloud> --apply
```

The helper downloads a consistent version-3 Michigan backup, writes it before creating the corresponding manifest, applies one season, and exports/verifies the result before continuing. Each resulting snapshot is the next season's pre-import backup. Read-back verifies every imported roster field and source hash and compares protected fields/documents across all 15 Michigan backup datasets. It also verifies every basketball and hockey roster for 2005–2026 is unchanged. Receipts and snapshots stay outside Git. A failure stops subsequent seasons; inspect saved receipts before resuming.

## Completed 2005–2026 import

All 22 official pages and 2,720 player-season observations were imported and read-back verified in production on 2026-10-18. The 961 reviewed identities matched 411 existing people and created 550 people. The import created 1,610 annual observations (1,597 for new identities and 13 for existing people) and reconciled 1,110 existing annual rows. Michigan's data revision advanced from 39 to 61. Production now contains 983 people and 2,761 annual rows, including retained records outside the official pages and future commitments. Nineteen existing-name aliases were explicitly reviewed. Four absent heights and Nicholas Capatina's 2019 `20/TBD` jersey remain unknown.

HTML, CSVs, source hashes, identity audit, alias mappings, and reviewed input are retained outside Git in `C:/Users/choug/.t3/artifacts/michigan-football-2005-2026`. Full predeployment exports, revision-bound before/after snapshots, and `official-football-receipt-1792376242220.json` are retained in `C:/Users/choug/Documents/cfb26-backups`. Every imported row, every original protected field across all 15 Michigan datasets, and all basketball/hockey season rosters were checked after the import. No unrelated team roster changed. A future rerun requires a fresh revision-bound preview and backup.

**Offline verified:** a complete `convex-test` rehearsal seeded a remapped copy of production's 433 people, 417 stints, and 1,151 Player Seasons, then applied all 22 reviewed seasons through the actual preview/apply functions. It created 550 people and 1,610 annual rows, reconciled 1,110 existing annual rows, and finished with 983 people and 2,761 annual rows, including retained records outside the official pages. It asserted that the two Will Johnson identities remain distinct and every original annual record's protected fields remain unchanged. This rehearsal changed no hosted deployment.

Development additionally passed a live two-row rehearsal covering historical namesake creation and an existing player's annual refresh before production deployment. The verification run passed 212 Node tests, 21 Convex tests, strict TypeScript, ESLint, documentation links, and the production build. The [Vercel production deployment](https://vercel.com/dreamsbydutchs-projects/cfb/8p88ixw8bJ1j81ox1BLTquF8WVji) completed its Convex-first build successfully.
