# Security and secrets

[Operations index](README.md) · [Wiki home](../README.md)

## Current trust model

**Current:** no authentication provider or authorization rules are configured. The four checked-in football functions are unauthenticated reads. Development exposes equivalent public reads plus internal migration functions; production currently has schema/data but no deployed application functions.

Do not assume the hosted football data is safe for unrestricted access merely because no auth exists. Classify its ownership/privacy requirements before deploying public functions, and add identity/ownership checks before introducing private or user-specific data.

## Environment classes

| Class                        | Example             | Exposure                          | Rule                                            |
| ---------------------------- | ------------------- | --------------------------------- | ----------------------------------------------- |
| Browser-public configuration | `VITE_CONVEX_URL`   | Bundled/readable by clients       | Never store secrets in `VITE_*`.                |
| Local deployment metadata    | `CONVEX_DEPLOYMENT` | Developer machine/CLI             | Keep in ignored `.env.local`.                   |
| Deployment credential        | `CONVEX_DEPLOY_KEY` | Hosting build environment         | Store only as a protected secret.               |
| Server integration secret    | Future API keys     | Convex/hosting server environment | Access only from server functions that need it. |

`.env.example` documents names and non-secret placeholders. `.env` and `.env.local` are ignored. Check staged files before every publish.

## Authentication and authorization requirements

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
- The current public functions do not write data or intentionally log player payloads.
- Validate input shape and impose practical size/count limits at public boundaries.
- Plan migrations and backups before destructive schema/data changes.

## Dependency and supply-chain rules

- Use the committed npm lockfile.
- Review package purpose, maintenance, runtime boundary, and transitive impact before adding a dependency.
- Avoid running unreviewed install scripts or copying secrets into command lines/output.
- Treat vulnerability findings by exploitability and app exposure; document any accepted risk.

## Reporting security work

Never paste real credentials into issues, commits, documentation, or chat output. If a secret is exposed, stop using it, rotate it in the owning service, remove it from the published surface/history as appropriate, and document only the remediation—not the secret.
