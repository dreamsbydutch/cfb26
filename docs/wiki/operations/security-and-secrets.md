# Security and secrets

[Operations index](README.md) · [Wiki home](../README.md)

## Current trust model

**Current:** no identity provider, user accounts, or sessions are configured. Football reads remain public. Development has one roster-edit mutation protected by a server-side `CFB26_ADMIN_KEY`; it fails closed while that variable is absent. Production remains on the prior function set until explicit promotion.

Do not assume the hosted football data is safe for unrestricted access merely because no auth exists. Classify its ownership/privacy requirements before deploying public functions, and add identity/ownership checks before introducing private or user-specific data.

## Environment classes

| Class                        | Example             | Exposure                      | Rule                                                                         |
| ---------------------------- | ------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| Browser-public configuration | `VITE_CONVEX_URL`   | Bundled/readable by clients   | Never store secrets in `VITE_*`.                                             |
| Local deployment metadata    | `CONVEX_DEPLOYMENT` | Developer machine/CLI         | Keep in ignored `.env.local`.                                                |
| Deployment credential        | `CONVEX_DEPLOY_KEY` | Hosting build environment     | Store only as a protected secret.                                            |
| Server integration secret    | `CFBD_API_KEY`      | Convex deployment environment | Access only from server functions that need it.                              |
| Single-owner admin secret    | `CFB26_ADMIN_KEY`   | Convex deployment environment | Minimum 24 characters; never store under `VITE_*` or persist in the browser. |

`.env.example` documents names and non-secret placeholders. `.env` and `.env.local` are ignored. Check staged files before every publish.

## Current single-owner roster gate

`rosterAdmin.updatePlayer` compares an unguessable key against `CFB26_ADMIN_KEY` before reading or writing roster data. The admin page holds the entered value only in React state. Configure it interactively so the value is not placed in shell history:

```powershell
npx convex env set CFB26_ADMIN_KEY
npx convex dev --once
```

Run those commands only after confirming the intended deployment; the push activates the changed typed environment for the deployed functions. Use a different key per environment. Removing or leaving the variable unset disables all roster writes. The mutation requires at least 24 characters, validates every editable field, caps position history, and does not intentionally log its argument. See [ADR 0005](../decisions/0005-single-owner-roster-admin-key.md).

This mechanism is deliberately narrower than authentication: it identifies one shared operator credential, not a person. Do not use it for private data, multiple admins, audit attribution, or user-facing permissions.

## Future authentication and authorization requirements

Before adding accounts or private records:

1. Choose and document the identity provider.
2. Define which routes/functions are public.
3. Add stable ownership/tenant fields and indexes to the schema.
4. Enforce identity and ownership in every relevant query and mutation; client-side hiding is not authorization.
5. Define onboarding, session expiry, account deletion, and data-retention behavior.
6. Add tests for cross-user/unauthenticated access.
7. Record the durable architecture choice in an ADR.

## Data and logging

- Return only client-needed fields from public functions.
- Do not log secrets, tokens, private records, or full third-party payloads.
- Public reads and the roster mutation do not intentionally log player payloads or credentials.
- Validate input shape and impose practical size/count limits at public boundaries.
- Plan migrations and backups before destructive schema/data changes.

## Dependency and supply-chain rules

- Use the committed npm lockfile.
- Review package purpose, maintenance, runtime boundary, and transitive impact before adding a dependency.
- Avoid running unreviewed install scripts or copying secrets into command lines/output.
- Treat vulnerability findings by exploitability and app exposure; document any accepted risk.

## Reporting security work

Never paste real credentials into issues, commits, documentation, or chat output. If a secret is exposed, stop using it, rotate it in the owning service, remove it from the published surface/history as appropriate, and document only the remediation—not the secret.
