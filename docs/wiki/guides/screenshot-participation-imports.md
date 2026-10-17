# Screenshot participation imports

[Guides](README.md) · [Wiki home](../README.md)

**Current source:** an assistant can transcribe a supplied screenshot into a reviewed JSON import, preview roster matches, and save cumulative participation by phase on Player Seasons. Player profiles show those totals and their cutoff. This is an assistant-operated workflow, not an in-app image uploader or automatic OCR service. Hosted availability requires deploying the updated backend and frontend.

## Interpret the screenshot

- Confirm season, phase, and number of team games covered with the owner. The cutoff is games played by the team, not calendar week.
- Transcribe each visible player's name, jersey, phase games played, and total snaps. For offense, retain the four snap columns as `pass`, `passBlock`, `run`, and `runBlock`; their sum must equal the player's total.
- Omit grades, ranks, penalties, and the team footer. Team plays are not the sum of player snaps. Do not invent rows for players absent from the image.
- Store a descriptive `sourceLabel` and the original image's SHA-256 as `sourceImageSha256`. Do not include credentials or local attachment paths in the input.
- `#G` is phase participation. It does not replace overall `playerSeasons.gamesPlayed`, starts, eligibility evidence, game logs, or grades. Unknown phases stay unknown.

The retained first input is [Michigan 2026 offense through five games](../../../scripts/imports/michigan-2026-offense-through-5.json): 34 players and 3,408 player snaps. The owner confirmed the cutoff. Avery Gach is #74 in the image and #89 in the production roster; Tomas O'Maera in the image maps to Tomas O'Meara #36. Those two rows carry reviewed **production-specific** player IDs; they must be reconciled independently for another deployment. Marky Walbridge is the name shown in the image. No roster names or jersey numbers are changed by this import.

## Preview and apply

Run the helper from the repository root with an explicit deployment URL. Without `--apply`, it only reads the public roster and prints matches and prior totals, even before the new backend is deployed:

```powershell
node --experimental-strip-types scripts/import-participation.mjs scripts/imports/michigan-2026-offense-through-5.json https://doting-chipmunk-7.convex.cloud
```

Unmatched or ambiguous rows block the entire import. Match normalized name and jersey first; supply a reviewed `playerId` only when the screenshot and existing roster establish the identity. Never match by jersey alone. Preserve the screenshot's original name and number in the input.

For an authorized write, provide `CFB26_OWNER_SESSION` through the process environment (an existing owner session for that deployment) and `CFB26_BACKUP_DIRECTORY` pointing to an existing directory outside the repository. Never put the token in command arguments, files, logs, or chat. Add `--apply` only after confirming the exact deployment under [Deployment](deployment.md).

The helper obtains an authenticated server preview, exports every Michigan backup dataset to a new version-3 backup file, registers the manifest at the previewed revision, and applies the import atomically. Any intervening Michigan write invalidates the preview/backup. It reads the saved totals back before reporting success. Preserve the backup outside Git.

## Update semantics

Run `npm run test:participation` for the import-specific checks and `npm run check` for the complete repository gate.

- Totals replace the same phase's cumulative snapshot; they are never added to a game-log sum.
- Identical imports do not change the snapshot or data revision. An older cutoff or decreasing cumulative games/snaps is rejected for separate owner review.
- Other phases and players absent from the input remain unchanged. A missing offensive breakdown stays unknown; it is not synthesized.
- The server requires a valid owner session, current backup, and matching preview revision. Successful changes advance the Michigan revision and owner audit trail.
- Ordinary annual roster edits preserve participation totals. Rollover clears them on the new season.
- Snapshots are included in existing Player Seasons backups. They are displayed separately from game-derived grades to avoid double counting.

**Current source:** the owner roster spreadsheet supports manual corrections to cumulative GP/snaps, team-games cutoffs, and available phase breakdowns. These revision-checked edits can lower erroneous totals, preserve other phases, and replace image provenance with an owner-entry source label. Clear every cell in a phase to remove an incorrect snapshot; zero GP/snaps records confirmed nonparticipation. Clear all category cells to remove a breakdown while retaining the phase total.

**Not yet implemented:** importing screenshots directly in the browser and extracting individual game records from cumulative screenshots.

## Verified production release — 2026-10-17

**Hosted current:** the importer is deployed to development `adjoining-opossum-710` and production `doting-chipmunk-7`. Development exercised backup, import, and read-back with Bryce Underwood's row. Production imported all 34 rows, advanced Michigan revision 25 to 26, and verified all counts, breakdowns, cutoffs, and source fingerprints after the web deployment. [Bryce's production profile](https://cfb-hazel.vercel.app/michigan/players/jh73xqrkd53ns3x1aasdqxhhsh8ba9a8?season=2026) displays 299 offensive snaps and five offensive appearances.

The [Vercel production deployment](https://cfb-fwzz4r7kd-dreamsbydutchs-projects.vercel.app) was published from the reviewed working tree based on commit `563680d754bd64e9cf5abb2be4a93c53cf1a883e`; the feature changes were not committed or pushed as part of this operation. Pre-deployment ZIP snapshots for both deployments and the version-3 pre-import Michigan backup are retained outside the repository in the operator's `Documents/cfb26-backups` directory. The production pre-import envelope is `michigan-doting-chipmunk-7.convex.cloud-1792275962939.json`.

Verification: 198 Node tests, four Convex integration tests, TypeScript, ESLint, Markdown links, local and hosted production builds, and production profile checks. `.vercelignore` excludes local scratch data, environment files, dependency directories, and generated build output from source uploads.

## Defensive screenshot — 2026 through six games

The defense input is `scripts/imports/michigan-2026-defense-through-6.json`: 36 players, 4,026 player snaps, with run-defense, pass-rush, and coverage breakdowns. The six-game cutoff is inferred from the screenshot's maximum games played (six); the offensive snapshot retains its separate five-game cutoff. Team snaps (366) are not the sum of player snaps.

Reviewed explicit identity mappings: Dom Nichols → Dominic Nichols (#8 EDGE), Cam Brandt → Cameron Brandt (#9 EDGE), Nathaniel Owusu-Boateng → N. Owusu-Boateng (#12 LB). Chris Bracy (#7 screenshot / #20 roster), I'Marion Stewart (#20 / #28), and Jamarion Vincent (#45 / #24) match by full name and defensive position. The input preserves the screenshot labels and numbers; roster identities and jersey assignments are unchanged.

Defensive breakdowns must be nonnegative whole numbers summing to total snaps and are accepted only for the defense phase. Player profiles display all three defensive categories. Grades and other defensive statistics are outside this participation import.

**Hosted current (2026-10-17):** deployed from an isolated checkout based on `3d4c108` to [Vercel production](https://cfb-mmzn764ly-dreamsbydutchs-projects.vercel.app). Development rehearsed Jonah Lea'ea's row. Production imported and read-back verified all 36 defensive rows at Michigan revision 30; all 34 existing offensive snapshots were unchanged. The pre-deployment ZIP is `production-before-defense-20261017.zip`; the pre-import Michigan envelope is `michigan-doting-chipmunk-7.convex.cloud-1792278902213.json`, both retained outside Git in `Documents/cfb26-backups`. The release passed 202 Node tests, five Convex integration tests, TypeScript, ESLint, Markdown links, and local/hosted builds. Changes were reconciled into the main workspace without deploying its unrelated roster-editor work; this operation did not commit or push source.

## Special-teams screenshot import — 2026-10-17

**Hosted current:** imported 60 players' special-teams games played and total snaps (1,406 player snaps) into production `doting-chipmunk-7`, advancing Michigan revision 30 to 31. The input is `scripts/imports/michigan-2026-special-teams-through-5.json`. The five-game cutoff is inferred from the screenshots' maximum appearances. Offense remains through five games; defense remains through six. All 60 saved snapshots were read-back verified, and all 70 existing offense/defense snapshots were unchanged.

The source SHA-256 covers the two original PNG byte sequences concatenated in top-table then continuation order. Cam Brown maps to Cameron Brown, #33 punter; previously reviewed nickname/jersey mappings are retained. Only games played and total snaps were imported; special-teams unit breakdowns and grades were not added. The deployed importer already supports this phase, so no code deployment was needed. The fresh pre-import backup is `michigan-doting-chipmunk-7.convex.cloud-1792279047305.json`, retained outside Git in `Documents/cfb26-backups`.
