# Security and secrets

[Operations index](README.md) · [Wiki home](../README.md)

## Trust model

Football exploration is public and read-only. `/admin/roster` is private to one owner. The checked-in backend exchanges the deployment's high-entropy `CFB26_ADMIN_KEY` for a random 32-byte token, stores only its SHA-256 hash, expires it after 12 hours, and supports explicit revocation. Every owner function verifies the token server-side; browser route visibility is not authorization.

This is intentionally a single-principal mechanism, not a user/role platform. It must not be extended to private multi-user records without a new identity and ownership design.

## Environment classes

| Class                        | Example             | Rule                                                                  |
| ---------------------------- | ------------------- | --------------------------------------------------------------------- |
| Browser-public configuration | `VITE_CONVEX_URL`   | Bundled and readable; never contains a secret                         |
| Local deployment metadata    | `CONVEX_DEPLOYMENT` | Keep in ignored local configuration                                   |
| Deployment credential        | `CONVEX_DEPLOY_KEY` | Protected hosting secret only                                         |
| Server integration secret    | `CFBD_API_KEY`      | Convex environment only                                               |
| Owner password               | `CFB26_ADMIN_KEY`   | Convex environment only; minimum 24 characters, unique per deployment |

Configure secrets interactively after confirming the exact deployment:

```powershell
npx convex env set CFB26_ADMIN_KEY
```

Do not put values in arguments, source, documentation, fixtures, logs, screenshots, or `VITE_*` variables. `.env` and `.env.local` remain ignored.

## Data protection

- Public functions return only the normalized football fields needed by the UI.
- External actions do not persist raw payloads or log credentials.
- Owner/session arguments are never intentionally logged.
- Public and owner inputs are shape-validated and bounded.
- Material Michigan operations require a verified backup; imports/rollovers require preview evidence.
- Official editions, frozen forecasts, and submitted ballots are immutable.
- Source failure retains prior good data rather than replacing it with an empty result.

## Release review

Before publishing, inspect tracked/staged files and history for secrets, run `npm run check`, verify absent/wrong/expired/revoked owner tokens fail, and ensure no internal mutation has become public accidentally. Use different owner/integration secrets in development and production.

If a secret is exposed, stop using it, rotate it in the owning service, remove it from published surfaces/history where required, and document only the remediation.
