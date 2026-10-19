# Deployment and controlled migration

[Guides index](README.md) · [Wiki home](../README.md)

## Recorded targets

| Item              | Value                          |
| ----------------- | ------------------------------ |
| GitHub repository | `dreamsbydutch/cfb26`          |
| Canonical branch  | `main`                         |
| Convex project    | `dreamsbydutch:michigan`       |
| Development       | `adjoining-opossum-710`        |
| Production        | `doting-chipmunk-7`            |
| Vercel project    | `cfb`                          |
| Production URL    | `https://cfb-hazel.vercel.app` |

The 41-table contract was deployed to both environments during the backed-up [2026-09-07 v2 cutover](../operations/convex-v2-cutover-2026-09-07.md). Development validated the backward-compatible 43-table three-rating contract on 2026-09-12 after a fresh export. No manifest-retirement migration was run in the rating release. Production delivery follows the main-branch Convex-first build. Four retired physical table names remain visible but empty. Identify the exact target and obtain a fresh export before extending a deployment.

## Migration rehearsal

1. Export the target Michigan legacy tables (`players`, `recruitingProfiles`, `rosterStints`, `movementEvents`, `draftOutcomes`, and `seasonalPlayerStats`) into one ignored JSON object keyed by table name.
2. Run `npm run migration:plan -- <legacy-export.json>`. Reconcile people, generated Player Seasons, draft outcomes, deleted PFF rows, and every unresolved record.
3. Run `npm run migration:prepare -- <legacy-export.json> <new-directory> <current-season>`. It refuses to overwrite a directory and emits target JSONL plus a source fingerprint/report.
4. Preserve both the raw export and prepared output outside the repository. Exercise restoration against a disposable development target.
5. Review every `needs_review` Player Season. The converter repeats the last retained stint facts because the legacy model did not preserve annual changes; it never invents participation, starts, scholarship, honors, or owner grades.
6. Only after reconciliation, schedule the exact-target cutover: clear incompatible legacy Michigan tables while the old schema is active, synchronize the new schema/functions, import the prepared target tables in relationship order, then run count and query verification. This is a maintenance operation and must not be combined with an unreviewed production web deployment.

PFF rows are counted in the report but intentionally have no target dataset. The proprietary file and parser are absent from source. Orphaned lifecycle/draft identities remain in the report; do not create guessed canonical links.

## Backup and restore

The owner UI exports version-3 Michigan datasets, computes a SHA-256 fingerprint over `{ dataRevision, datasets, schemaVersion }`, creates a server-side manifest for that exact revision, and downloads the fingerprinted envelope. Material imports, rollovers, merges, and deletes reject stale or pre-revision manifests. The preparer remains compatible with previously downloaded version-2 envelopes.

Prepare a backup without writing a deployment:

```bash
npm run restore:prepare -- path/to/cfb26-michigan.json path/to/new-restore-directory
```

The command rejects a modified envelope, a version-3 envelope without an integer data revision, unexpected/missing datasets, or an existing output directory. It emits ordered JSONL and `restore-manifest.json`. Restore only to a confirmed target after exporting its current state. Use the Convex CLI import mode appropriate to the installed CLI and rehearse replace behavior on development; inspect `npx convex import --help` rather than assuming production flags. After import, reconcile every manifest count, sampled relationship, Player Game summary, and profile before reopening owner writes.

## Development-first release

1. Confirm the commit, development deployment, and intended data operation.
2. Run `npm run check` and inspect the full diff for secrets/generated edits.
3. Complete the migration rehearsal and verified target export when schema/data changes require it. For the revision cutover, deploy optional `backupManifests.dataRevision`, run `migrations:run` to audit/remove old server manifests, verify no unversioned manifests remain, then tighten only in a later reviewed source change.
4. Set `CFBD_API_KEY` and a unique `CFB26_ADMIN_KEY` in the development Convex environment through interactive secret input.
5. Run `npx convex dev --once` only after the target is confirmed.
6. Verify public reads, owner session rejection/expiry, one reversible owner workflow, source staleness, official publication readiness, and data counts.
7. Run direct CFBD and nflverse syncs in bounded slices; inspect rejected identities and last-valid preservation.
8. Build and smoke-test `/`, `/games`, and `/admin/roster` at narrow and wide widths.
9. Promote production only under separate authorization, using a fresh production export and the same reconciliation gates.

`vercel.json` runs `npx convex deploy --cmd 'npm run build'`. A failed Convex step means the web release is not releasable. Preview publication follows the [$preview-pr workflow](preview-pull-request.md) and never authorizes production.

**Current source:** TanStack Start requires `@tanstack/react-start` 1.168.60 or later and a resolved `@tanstack/start-server-core` 1.169.39 or later to address [CVE-2026-102989](https://github.com/TanStack/router/security/advisories/GHSA-qx66-fv34-fjm8). Keep the direct React Router dependency aligned with Start, update the lockfile, and run `npm run check` before redeploying. Vercel blocks affected versions; upgrade the dependencies rather than overriding that block.

## Rollback

- Application rollback deploys a known-good commit through the same pipeline.
- Data rollback restores the verified pre-operation export to the exact target and reconciles counts before traffic/writes resume.
- Never patch generated files or hand-edit production documents as a substitute for a controlled restore.
- If the web build fails after a backend change, first determine backward compatibility; do not blindly deploy an older schema over migrated data.

Record the commit, source fingerprints, counts, operation timestamps, direct URLs, and smoke results after every hosted cutover.

## Roster table release — 2026-10-18

**Hosted current:** [production deployment](https://cfb-64zk28u4d-dreamsbydutchs-projects.vercel.app), aliased to [the production site](https://cfb-hazel.vercel.app/), was published from the reviewed working tree based on `d342145`. This includes the three-column position layout, college-year labels, separate ST Snaps for offensive/defensive players, and the Recruit composite rank/rating column. Convex production `doting-chipmunk-7` received the indexed recruiting summary query after successful development verification on `adjoining-opossum-710`.

The pre-deployment snapshot `production-before-recruit-column-20261018.zip` is retained outside Git in `Documents/cfb26-backups`. Tests, TypeScript, lint, Markdown links, local build, and hosted build passed. Live verification at desktop and mobile widths confirmed the position order, removed columns, specialist-only Snaps behavior, and saved recruiting values (Bryce Underwood: `#1 (0.9998)`), with no browser console errors or page overflow. No player data import, commit, or push was performed for this release.

## Sports archive and navigation release ? 2026-10-18

**Hosted backend:** development `adjoining-opossum-710` and production `doting-chipmunk-7` now validate the 51-table source contract, including independent basketball and hockey schedule storage. The verified production snapshot `production-before-sports-release-20261018-231444.zip` is retained in `Documents/cfb26-backups`, outside Git. No existing index was deleted during promotion.

Production contains 912 hockey and 816 basketball schedule entries for 2005?06 through 2026?27. Every saved field was verified against the reviewed import. Roster values, the other sport's schedules, and football revision 61 remained unchanged during each import. See [hockey schedules](../reference/michigan-hockey-schedules.md) and [basketball schedules](../reference/michigan-basketball-schedules.md) for receipts and source limits.

**Current source:** Michigan navigation switches between Football, Basketball, and Hockey. Football opens the roster matrix; retired Overview, Movement, Alumni, Compare, Matrix-alias, and lineup URLs return to Football while retaining season. Player profiles remain available. The web release target is Vercel project `cfb` and [the production site](https://cfb-hazel.vercel.app/).

`npm run check` passed 215 Node tests, 28 Convex tests, TypeScript, ESLint, Markdown links, and the production build. Browser visual verification is unavailable in this session; hosted HTTP and deployment-state checks supplement the automated checks.
