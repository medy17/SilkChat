# Setup and Deployment Guide

This guide describes the repository’s current cloud-dev, staging, and production workflows. Commands here assume Bun; do not substitute npm.

## Runtime Architecture

SilkChat has two deployed runtime layers:

1. The TanStack Start app runs on Vercel. It serves the UI and proxies `/api/auth/*` to Convex.
2. Convex runs Better Auth, chat streaming, tools, storage coordination, billing, usage metering, speech-to-text, and image-generation jobs.

The browser connects to the Convex deployment URL. Better Auth itself runs in Convex and uses the application origin as its public base URL.

## Environment Files

Local scripts read ignored files under `envs/`:

| File | Purpose |
| --- | --- |
| `.env.local` | local app and shared developer values |
| `.env.cloud-dev` | cloud-dev deployment selector and public URLs |
| `.env.staging` | staging deployment selector |
| `.env.convex.prod` | production Convex deployment selector |
| `.env.convex` | shared Convex runtime variables |
| `.env.convex.cloud-dev` | cloud-dev Convex overrides |
| `.env.convex.staging` | staging Convex overrides |
| `.env.convex.production` | production Convex overrides |

Start from `.env.example`. Never commit populated environment files.

## Local Development Against Cloud Dev

Create a portable development deployment once if needed:

```bash
bunx convex deployment create dev/cloud-dev --type dev
```

Set its selector and URLs in `envs/.env.cloud-dev`, then run:

```bash
bun run dev
```

`dev` and `cloud:dev:app` are the same application path. They start Vite on port 3000 and a local Sharp-backed image optimizer. Uploads stay in the cloud-dev R2 bucket; local image transforms are cached locally to avoid Cloudflare transform usage during iteration.

Convex cloud dev does not hot-reload from local source. Push backend or schema changes explicitly:

```bash
bun run cloud:dev:push
```

If Convex environment values changed, push the merged shared and cloud-dev files:

```bash
bun run env:convex:cloud-dev:push
```

## Staging Deployment

Normal staging deployment must be run from a clean `staging` branch:

```bash
bun run staging:deploy
```

The command checks the branch and worktree, runs typecheck and the full test suite, pushes Convex staging, then pushes `origin/staging`. The staging branch push drives the matching frontend deployment.

Use these lower-level commands only when intentionally operating one layer:

```bash
bun run env:convex:staging:push  # sync Convex staging environment values
bun run staging:push             # push Convex staging code only
bun run staging:vercel:deploy    # manual Vercel Preview deployment and aliasing
```

`envs/.env.staging` supplies `STAGING_CONVEX_DEPLOYMENT`. Target-specific auth origins and R2 buckets belong in `envs/.env.convex.staging`.

## Production Deployment

Normal production deployment must be run from a clean `main` branch:

```bash
bun run prod:deploy
```

It performs the same verification and ordering as staging: typecheck, tests, Convex production deployment, then `origin/main` push. This keeps Convex and the frontend revision aligned.

Lower-level production operations are available for deliberate manual work:

```bash
bun run env:convex:prod:push      # sync Convex production environment values
bun run prod:push -- --dry-run   # preview the Convex production deployment
bun run prod:push                 # deploy Convex production code only
```

`envs/.env.convex.prod` selects the production deployment. Production-specific runtime overrides belong in `envs/.env.convex.production`.

## Environment Ownership

### App and Vercel

The app runtime needs values used by Vite, server-side proxy routes, analytics, email, and checkout links. The core connection values are:

- `VITE_CONVEX_URL`
- `VITE_CONVEX_API_URL`
- `VITE_CONVEX_SITE_URL`
- `VITE_ENABLED_INTERNAL_PROVIDERS`
- `VITE_ENABLE_VOICE_INPUT`

### Convex

Convex must receive backend secrets and configuration, including:

- `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `VITE_BETTER_AUTH_URL`, `VITE_CONVEX_SITE_URL`, and optional `JWKS`
- `OPENROUTER_API_KEY`, `ENCRYPTION_KEY`, `IDENTITY_FINGERPRINT_PEPPER`
- fal, speech-to-text, search, R2, billing, and metering values

Some public `VITE_*` values appear in both layers because Convex-hosted auth also needs to know its public app and site origins. A value configured only in Vercel is not automatically available to Convex.

## Auth and Static JWKS

The public auth path remains `/api/auth/*` on the app origin. `src/lib/auth-server.ts` forwards requests to Convex, where `convex/auth.ts` runs Better Auth.

For a new Convex deployment, or after intentionally rotating auth keys, generate and store static JWKS for that deployment:

```bash
bunx convex run auth:rotateKeys | bunx convex env set JWKS
```

`JWKS` is deployment state, not something to refresh on every code push. Ensure the command targets the intended deployment before running it.

If sign-in appears to succeed and then disappears, inspect:

- `GET /api/auth/get-session`
- `GET /api/auth/convex/jwks`

For provider-specific auth setup, see [OAuth Configuration](./OAUTH_SETUP.md).

## Change Workflow

For normal changes:

1. Make and verify the change locally.
2. Run `bun run check-types` and `bun run test`.
3. Push Convex changes to cloud dev when needed.
4. Commit the complete revision.
5. Use `staging:deploy` or `prod:deploy` from the matching clean branch.

Backend/schema changes require a Convex push. Browser/server-app changes deploy through the Git branch. Changes spanning both must use the synchronized deploy command.
