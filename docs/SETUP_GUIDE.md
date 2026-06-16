# Setup Guide

This guide documents the current working setup for local development, production deployment, auth, and faster debugging.

## Architecture Overview

The app is split across three runtime layers:

1. `Vercel app`
   - serves the TanStack Start app
   - proxies `/api/auth/*` to Convex
2. `Convex`
   - runs Better Auth, chat, tools, file routes, speech-to-text, search, and model execution

Convex issues and validates Better Auth JWTs itself. The app keeps `/api/auth/*` stable by proxying that path to the Convex site URL.

## Local Development

### Recommended flow

1. Copy `.env.example` to `envs/.env.local`.
2. Fill in the local/provider values you need.
3. Create `envs/.env.cloud-dev` for the portable cloud dev deployment.
4. Run the local app against cloud dev:

```bash
bun run dev
```

This runs the same app path as `bun run cloud:dev:app`.

### Local app + cloud dev Convex

Use this when you want fast local UI iteration with Convex data that lives in
the cloud instead of being tied to one machine's local deployment.

Create a cloud dev deployment once:

```bash
bunx convex deployment create dev/cloud-dev --type dev
```

Create `envs/.env.cloud-dev`:

```bash
CLOUD_DEV_CONVEX_DEPLOYMENT="dev:your-cloud-dev-deployment"
CLOUD_DEV_CONVEX_URL="https://your-cloud-dev-deployment.convex.cloud"
CLOUD_DEV_CONVEX_API_URL="https://your-cloud-dev-deployment.convex.site"
CLOUD_DEV_CONVEX_SITE_URL="https://your-cloud-dev-deployment.convex.site"
VITE_R2_PUBLIC_BASE_URL="https://your-cloud-dev-r2-public-host"
```

Run the local app against cloud dev:

```bash
bun run cloud:dev:app
```

This starts Vite and the local image optimizer. Cloud-dev uploads live in R2,
but local browsing uses the optimizer to mock Cloudflare image transforms and
avoid spending transform quota during normal iteration.

Push Convex code to cloud dev:

```bash
bun run cloud:dev:push
```

### Push local code to staging (`knowing-falcon-519`)

Preferred (cross-platform):

```bash
bun run staging:push
```

This only pushes code to the existing Convex deployment. It does not require an
extra auth step on every run.

`JWKS` is deployment-instance state. You only need to set or refresh it when:

- you create a brand new Convex deployment instance
- you intentionally rotate Better Auth keys for an existing deployment

Manual shell-specific variants:

```powershell
$env:CONVEX_DEPLOYMENT="dev:knowing-falcon-519"
bunx convex dev --once --codegen disable --typecheck disable
Remove-Item Env:CONVEX_DEPLOYMENT
```

```bash
CONVEX_DEPLOYMENT=dev:knowing-falcon-519 bunx convex dev --once --codegen disable --typecheck disable
```

These push Convex functions to staging but keep your local default unchanged.

### Deploy the Vercel staging app

When browser app code or Vercel runtime envs change, deploy a Preview build and
alias the staging domains to that Preview deployment:

```bash
bun run staging:vercel:deploy
```

This keeps `silkchat-staging.xyz` and `img.silkchat-staging.xyz` on Preview envs
instead of accidentally serving the production deployment.

### Push Convex code to production (`fearless-bobcat-351`)

Production deploys use `envs/.env.convex.prod`:

```bash
CONVEX_DEPLOYMENT="prod:fearless-bobcat-351"
```

Dry-run first:

```bash
bun run prod:push -- --dry-run
```

Then deploy:

```bash
bun run prod:push
```

Convex runtime environment values live in `envs/.env.convex`. Push them
explicitly:

```bash
bun run env:convex:prod:push
```

Use target-specific Convex override files for values that differ by environment:

- `envs/.env.convex.staging`
- `envs/.env.convex.cloud-dev`
- `envs/.env.convex.production`

For staging auth and storage, `envs/.env.convex.staging` should include:

```bash
VITE_BETTER_AUTH_URL="https://silkchat-staging.xyz"
R2_BUCKET="silkchat-staging"
R2_ENDPOINT="https://..."
R2_FORCE_PATH_STYLE="true"
R2_PUBLIC_BASE_URL="https://r2.silkchat-staging.xyz"
R2_SECRET_ACCESS_KEY="..."
R2_ACCESS_KEY_ID="..."
```

Then push the appropriate target-specific envs with the matching `env:convex:*:push` script.

### Fastest debug loop

Use a local app first. Repeated Vercel builds are too slow for auth and provider debugging.

Good local loops:

- local app + cloud dev Convex
- local app + the Convex staging deployment

Only switch back to Vercel when you already have a likely fix.

## Production Deployment

### Vercel owns

- `BETTER_AUTH_SECRET`
- `VITE_BETTER_AUTH_URL`
- `VITE_CONVEX_SITE_URL`
  - local default site port is `3211`, not `3210`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `VITE_CONVEX_URL`
- `VITE_CONVEX_API_URL`
- `VITE_ENABLED_INTERNAL_PROVIDERS`

### Convex owns

- model provider secrets
- search provider secrets
- encryption key
- storage credentials
- optional static `JWKS` for Better Auth / Convex JWT validation

Use:

```bash
bunx convex env set NAME value
bunx convex deploy
vercel --prod
```

## Auth-Specific Notes

### Better Auth details that matter in this repo

- the browser still talks to `/api/auth/*` on the app origin
- the app route proxies those requests to the Convex site URL
- Convex validates JWTs against its own issuer and JWKS:
  - issuer: `CONVEX_SITE_URL`
  - JWKS: `${CONVEX_SITE_URL}/api/auth/convex/jwks`
  - application ID: `convex`
- this repo can optionally use static JWKS from the Convex env var `JWKS`
  instead of the live `/api/auth/convex/jwks` endpoint

### Static JWKS workflow

For a brand new Convex deployment instance, or after an intentional auth key
rotation, run:

```bash
bunx convex run auth:rotateKeys | bunx convex env set JWKS
```

Examples:

```bash
CONVEX_DEPLOYMENT=dev:knowing-falcon-519 bunx convex run auth:rotateKeys | bunx convex env set JWKS
```

```bash
bunx convex run auth:rotateKeys | bunx convex env set JWKS
```

The first example targets a specific cloud deployment. The second uses whatever
deployment your local Convex CLI is currently pointed at.

### Session mismatch symptom

If the UI briefly looks signed in and then drops back to signed out, inspect:

- `GET /api/auth/get-session`
- `GET /api/auth/convex/jwks`

If either one returns `500`, the auth state will look inconsistent even when the OAuth callback itself succeeded.

## Google OAuth Notes

- keep Google envs free of trailing whitespace
- make redirect URIs match exactly
- use:
  - local: `http://localhost:3000/api/auth/callback/google`
  - production: `https://your-domain/api/auth/callback/google`

## Internal Provider Setup

The browser only shows internal providers listed in:

```bash
VITE_ENABLED_INTERNAL_PROVIDERS
```

The backend only enables providers that actually have keys configured in Convex.

Both must be correct.

## Suggested Change Workflow

### Setup/auth changes

1. reproduce locally
2. fix locally
3. verify `/api/auth/get-session` and `/api/auth/convex/jwks`
   - for local Convex, the direct JWKS check should use `http://127.0.0.1:3211/api/auth/convex/jwks`
4. deploy Convex if backend code changed
5. deploy Vercel if app code or app env changed

### Model/provider changes

1. add or update the model registry
2. patch provider factory or routing logic if the provider is new
3. verify internal provider env configuration
4. test locally with a real request
5. deploy Convex
6. deploy Vercel only if the browser app or app env changed

For the detailed model workflow, see [MODEL_PROVIDER_GUIDE.md](./MODEL_PROVIDER_GUIDE.md).
