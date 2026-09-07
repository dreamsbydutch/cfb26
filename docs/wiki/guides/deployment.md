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

The 41-table source contract was deployed to development and production during the backed-up 2026-09-07 v2 cutover. Michigan data was migrated and reconciled; four retired physical table names remain visible but empty. The operation did not deploy the web application. See the [cutover record](../operations/convex-v2-cutover-2026-09-07.md). Do not repeat or extend the procedure without reconfirming the exact target and obtaining an immediate export.

## Migration rehearsal

1. Export the target Michigan legacy tables (`players`, `recruitingProfiles`, `rosterStints`, `movementEvents`, `draftOutcomes`, and `seasonalPlayerStats`) into one ignored JSON object keyed by table name.
2. Run `npm run migration:plan -- <legacy-export.json>`. Reconcile people, generated Player Seasons, draft outcomes, deleted PFF rows, and every unresolved record.
3. Run `npm run migration:prepare -- <legacy-export.json> <new-directory> <current-season>`. It refuses to overwrite a directory and emits target JSONL plus a source fingerprint/report.
4. Preserve both the raw export and prepared output outside the repository. Exercise restoration against a disposable development target.
5. Review every `needs_review` Player Season. The converter repeats the last retained stint facts because the legacy model did not preserve annual changes; it never invents participation, starts, scholarship, honors, or owner grades.
6. Only after reconciliation, schedule the exact-target cutover: clear incompatible legacy Michigan tables while the old schema is active, synchronize the new schema/functions, import the prepared target tables in relationship order, then run count and query verification. This is a maintenance operation and must not be combined with an unreviewed production web deployment.

PFF rows are counted in the report but intentionally have no target dataset. The proprietary file and parser are absent from source. Orphaned lifecycle/draft identities remain in the report; do not create guessed canonical links.

## Backup and restore

The owner UI exports v2 Michigan datasets, computes a SHA-256 fingerprint over `{ schemaVersion, datasets }`, creates a server-side manifest, and downloads the fingerprinted envelope. Material imports, rollovers, merges, and deletes require that manifest.

Prepare a backup without writing a deployment:

```bash
npm run restore:prepare -- path/to/cfb26-michigan.json path/to/new-restore-directory
```

The command rejects a modified envelope, unexpected/missing datasets, or an existing output directory. It emits ordered JSONL and `restore-manifest.json`. Restore only to a confirmed target after exporting its current state. Use the Convex CLI import mode appropriate to the installed CLI and rehearse replace behavior on development; inspect `npx convex import --help` rather than assuming production flags. After import, reconcile every manifest count, sampled relationship, Player Game summary, and profile before reopening owner writes.

## Development-first release

1. Confirm the commit, development deployment, and intended data operation.
2. Run `npm run check` and inspect the full diff for secrets/generated edits.
3. Complete the migration rehearsal and verified target export when schema/data changes require it.
4. Set `CFBD_API_KEY` and a unique `CFB26_ADMIN_KEY` in the development Convex environment through interactive secret input.
5. Run `npx convex dev --once` only after the target is confirmed.
6. Verify public reads, owner session rejection/expiry, one reversible owner workflow, source staleness, official publication readiness, and data counts.
7. Run direct CFBD and nflverse syncs in bounded slices; inspect rejected identities and last-valid preservation.
8. Build and smoke-test `/`, `/games`, and `/admin/roster` at narrow and wide widths.
9. Promote production only under separate authorization, using a fresh production export and the same reconciliation gates.

`vercel.json` runs `npx convex deploy --cmd 'npm run build'`. A failed Convex step means the web release is not releasable. Preview publication follows the [$preview-pr workflow](preview-pull-request.md) and never authorizes production.

## Rollback

- Application rollback deploys a known-good commit through the same pipeline.
- Data rollback restores the verified pre-operation export to the exact target and reconciles counts before traffic/writes resume.
- Never patch generated files or hand-edit production documents as a substitute for a controlled restore.
- If the web build fails after a backend change, first determine backward compatibility; do not blindly deploy an older schema over migrated data.

Record the commit, source fingerprints, counts, operation timestamps, direct URLs, and smoke results after every hosted cutover.
