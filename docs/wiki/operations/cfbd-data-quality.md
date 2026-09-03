# CFBD data quality

[Operations index](README.md) · [Wiki home](../README.md)

## Current safeguards

**Current in checked-in source:** CFBD validation has three explicit seams:

1. `cfbdClient.ts` authenticates requests, validates the minimum supported contract for each approved endpoint, classifies failures, and retries only network, rate-limit, and server failures with bounded exponential backoff.
2. `cfbdAudit.ts` checks one season/week dataset for duplicate or future games, wrong seasons, invalid participants/scores, missing FBS representation, orphaned box scores, and participant mismatches. Missing FBS representation is a coverage warning because an idle team can be legitimate; corrupt joins and game facts are errors.
3. `cfbdHealth.probe` calls ten official inputs without writing data. Games, team game stats, FBS membership, and ordinary season stats are required; advanced stats, recruiting, talent, returning production, transfers, and coaching are optional.

Offline fixtures contain no key and make no network requests.

## Offline checks

Run all tests:

```powershell
npm test
```

Run only the CFBD suite:

```powershell
npm run test:cfbd
```

`npm run check` includes the complete offline suite before lint, documentation links, and the production build.

## Live canary

The canary uses `CFBD_API_KEY` from the selected Convex deployment. It never returns or logs the key and does not write database rows. Confirm the exact development deployment first. The checked-in function must already be pushed to that environment; this command does not use `--push`:

```powershell
npm run cfbd:probe -- '{"season":2025,"week":1}'
```

Do not add `--prod` unless a production probe is explicitly authorized. A successful report requires non-empty, contract-valid rows from all four core endpoints. Optional failures remain visible but do not mark core health unavailable.

## Reading failures

| Kind             | Meaning                                              | Retry behavior                          |
| ---------------- | ---------------------------------------------------- | --------------------------------------- |
| `authentication` | Missing/invalid entitlement or key (`401`/`403`).    | Do not retry.                           |
| `rate_limit`     | CFBD returned `429`.                                 | Retry within the configured bound.      |
| `server`         | CFBD returned `5xx`.                                 | Retry within the configured bound.      |
| `network`        | The request could not reach CFBD.                    | Retry within the configured bound.      |
| `invalid_json`   | A successful response was not JSON or failed decode. | Do not retry.                           |
| `contract`       | Required rows or fields changed shape.               | Do not retry; inspect provider changes. |

An empty endpoint is a warning rather than a contract error because preseason and partial-week sources can legitimately have no rows. Required endpoints still need non-empty results for overall health to pass.

## Remaining limits

- The canary proves access and contract compatibility for one requested season/week; it does not prove full historical coverage.
- The season audit is pure and ready to gate future snapshot activation, but the existing row-by-row game synchronization has not yet been replaced with staged atomic activation.
- No live canary runs in CI or cron. This avoids consuming external quota until alerting and ownership are deliberately configured.

[Back to operations](README.md)
