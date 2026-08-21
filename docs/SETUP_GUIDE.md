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

`dev` and `cloud:dev:app` are the same application path. They start Vite on port 3000 and a local Sharp-backed image optimizer. Uploads stay in the cloud-dev R2 bucket; local image transforms are cached locally to avoid Cloudflare transform usage during iteration. The dev loop logs each optimizer transform or cache purge with its HTTP status, cache hit/miss, output format and size, and elapsed time. In an interactive terminal, the hotkey strip stays below service output and offers backend sync, per-service restarts, optimizer cache purging, a full local-stack restart, and shutdown. Hotkeys act immediately; Enter is not required.

### Stable HTTPS development URL

The development supervisor can also run a named, remotely managed Cloudflare Tunnel.
First create the tunnel and configure its published application route to send the
chosen hostname to `http://localhost:3000`. Install `cloudflared`, then add the
following ignored values to `envs/.env.local`:

```bash
DEV_PUBLIC_URL="https://dev.example.com"
CLOUDFLARE_TUNNEL_TOKEN="your-tunnel-token"
```

Both values are required together. When they are present, `bun run dev` starts the
tunnel alongside Vite and the local image optimizer, explicitly allows its hostname
in Vite, and stops all three processes together. The token is passed to `cloudflared`
through its `TUNNEL_TOKEN` environment variable and is not placed in the command
line. Local image transforms and cache purges use the app-owned
`/_silkchat/image/*` route because Cloudflare reserves `/cdn-cgi/*` at the edge.

Because Better Auth runs in Convex, set the same public origin in
`envs/.env.convex.cloud-dev`:

```bash
VITE_BETTER_AUTH_URL="https://dev.example.com"
BETTER_AUTH_ADDITIONAL_HOSTS="localhost:3000,127.0.0.1:3000"
```

Push that environment change once:

```bash
bun run env:convex:cloud-dev:push
```

The additional-host allowlist enables request-specific OAuth callbacks on both
localhost and the HTTPS tunnel. Better Auth validates the original host forwarded
by the app proxy, so OAuth state cookies stay on the same origin that initiated
sign-in. Keep this list exact; do not use wildcard public domains.

Add the following entries to the Google web OAuth client:

```text
Authorized JavaScript origin: https://dev.example.com
Authorized redirect URI:      https://dev.example.com/api/auth/callback/google
```

The hostname publishes the development server to the Internet. Protect it with a
Cloudflare Access application restricted to the intended developer accounts.

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
- `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_POSTHOG_ENVIRONMENT`
- `VITE_APP_RELEASE`

### Convex

Convex must receive backend secrets and configuration, including:

- `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `VITE_BETTER_AUTH_URL`, `VITE_CONVEX_SITE_URL`, and optional `JWKS`
- `OPENROUTER_API_KEY`, `ENCRYPTION_KEY`, `IDENTITY_FINGERPRINT_PEPPER`
- `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST`, `POSTHOG_ENVIRONMENT`, `APP_RELEASE`
- fal, speech-to-text, search, R2, billing, and metering values

Some public `VITE_*` values appear in both layers because Convex-hosted auth also needs to know its public app and site origins. A value configured only in Vercel is not automatically available to Convex.

### PostHog telemetry

PostHog is the only telemetry destination. The browser sends product events, web vitals,
masked session replay, and exceptions. Convex sends authoritative product events and
`$ai_generation` metrics without prompts, responses, tool arguments, or attachment data.

PostHog starts opted out in the browser until the signed-in user's settings load. Users can disable
optional telemetry under Settings > Privacy. The account preference also disables backend product
events and AI traces. Essential security, billing, and service reliability logs are not controlled
by this preference.

Set `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST`, `POSTHOG_ENVIRONMENT`, and `APP_RELEASE` in each
Convex deployment. Add the matching `VITE_POSTHOG_*` and `VITE_APP_RELEASE` values to Vercel.

Production source map uploads also require `POSTHOG_API_KEY` and `POSTHOG_PROJECT_ID` in the Vercel
build environment. The API key needs write access to PostHog error tracking. The build skips source
map upload when either value is missing.

Convex platform logs do not use an application SDK. Configure a PostHog log stream for each Convex
deployment in the Convex dashboard. Use the same project token and PostHog host as the application,
and set the service name to identify the environment, for example `silkchat-convex-production`.

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
