# SilkChat

SilkChat is a TanStack Start + Convex chat app with Better Auth, internal provider credits, BYOK support, file uploads, web search, artifacts, and image generation.

This repository is the source of truth for setup and model/provider changes. The old hosted docs were lagging behind the actual code.

## Stack

- `src/`: TanStack Start app, Better Auth routes, UI, browser env handling
- `convex/`: chat runtime, model selection, provider factory, settings, HTTP actions
- `Convex`: app backend, chat streaming, provider execution, user settings, file storage integration
- `Vercel`: web app hosting and server routes

## Quick Start

1. Install dependencies:

```bash
bun install
```

2. Copy `.env.example` to `envs/.env.local` and fill in the local/provider values you actually need.

3. Create `envs/.env.cloud-dev` with the cloud dev Convex deployment and R2 public URL.

4. Start local development against cloud dev:

```bash
bun run dev
```

`bun run dev` starts two processes:

- the Vite app
- a local Sharp-backed image optimizer that serves mocked `/cdn-cgi/image/...` URLs and caches outputs in `/.optimised-image-cache`

Cloud-dev uploads live in R2, while local browsing uses the optimizer to mock Cloudflare image transforms and avoid spending transform quota during normal iteration.

The app runs at `http://localhost:3000`.

## Local App With Cloud Dev Convex

Use this when you want local UI iteration, but cloud-hosted Convex data that
follows you between machines.

Create a cloud dev deployment:

```bash
bunx convex deployment create dev/cloud-dev --type dev
```

Then create `envs/.env.cloud-dev`:

```bash
CLOUD_DEV_CONVEX_DEPLOYMENT="dev:your-cloud-dev-deployment"
CLOUD_DEV_CONVEX_URL="https://your-cloud-dev-deployment.convex.cloud"
CLOUD_DEV_CONVEX_API_URL="https://your-cloud-dev-deployment.convex.site"
CLOUD_DEV_CONVEX_SITE_URL="https://your-cloud-dev-deployment.convex.site"
VITE_R2_PUBLIC_BASE_URL="https://your-cloud-dev-r2-public-host"
```

Run the local app against that cloud dev deployment:

```bash
bun run cloud:dev:app
```

This starts Vite and the local image optimizer. Cloud-dev uploads live in R2,
but local browsing uses the optimizer to mock Cloudflare image transforms and
avoid spending transform quota during normal iteration.

Push Convex functions to that cloud dev deployment:

```bash
bun run cloud:dev:push
```

## Push To Staging

When local iteration is done and you want to push Convex functions to staging
(`knowing-falcon-519`) without changing your local setup:

```bash
bun run staging:push
```

This script is cross-platform (Windows/macOS/Linux).
It also cleans up any root `.env.local` that Convex CLI creates while pushing.

`staging:push` only pushes code. It does not need any extra auth step on every run.
The only time you need to refresh `JWKS` is when you create a brand new Convex
deployment instance or intentionally rotate Better Auth keys for an existing one.

When browser app code or Vercel runtime envs change, deploy a Vercel Preview build
and alias the staging domains to that Preview deployment:

```bash
bun run staging:vercel:deploy
```

This keeps `silkchat-staging.xyz` and `img.silkchat-staging.xyz` on Preview envs
instead of accidentally serving the production deployment.

Manual overrides:

```powershell
$env:CONVEX_DEPLOYMENT="dev:knowing-falcon-519"
bunx convex dev --once --codegen disable --typecheck disable
Remove-Item Env:CONVEX_DEPLOYMENT
```

```bash
CONVEX_DEPLOYMENT=dev:knowing-falcon-519 bunx convex dev --once --codegen disable --typecheck disable
```

## Push To Production

Production Convex deploys use `envs/.env.convex.prod`, which should point at the
actual production deployment:

```bash
CONVEX_DEPLOYMENT="prod:fearless-bobcat-351"
```

Preview the target without deploying:

```bash
bun run prod:push -- --dry-run
```

Push Convex functions to production:

```bash
bun run prod:push
```

## Environment Split

The repo uses two different runtime environments.

### Vercel environment

These variables are read by the Vercel app/server runtime:

- `ARTIFICIAL_ANALYSIS_API_KEY`
- `VITE_BETTER_AUTH_URL`
- `EMAIL_PROVIDER`
- `EMAIL_FROM`
- `RESEND_API_KEY`
- `VITE_CONVEX_URL`
- `VITE_CONVEX_API_URL`
- `VITE_CONVEX_SITE_URL`
- `VITE_ENABLED_INTERNAL_PROVIDERS`
- `VITE_ENABLE_VOICE_INPUT`

### Convex environment

These variables are read by Convex actions and HTTP routes:

- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `JWKS`
- `VITE_BETTER_AUTH_URL`
- model provider secrets
- search provider secrets
- storage credentials
- streaming credentials
- billing webhook secrets
- credit configuration
- `ENCRYPTION_KEY`

Use `envs/.env.convex` as the source file for Convex runtime envs:

```bash
bun run env:convex:prod:push
```

Target-specific Convex values can override the shared file:

- `envs/.env.convex.staging`
- `envs/.env.convex.cloud-dev`
- `envs/.env.convex.production`

For example, staging should set its own auth origin and storage provider values:

```bash
VITE_BETTER_AUTH_URL="https://silkchat-staging.xyz"
R2_BUCKET="silkchat-staging"
R2_ENDPOINT="https://..."
R2_FORCE_PATH_STYLE="true"
R2_PUBLIC_BASE_URL="https://r2.silkchat-staging.xyz"
R2_SECRET_ACCESS_KEY="..."
R2_ACCESS_KEY_ID="..."
```

- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY` for routing internal text models through OpenRouter
- `XAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `STT_PROVIDER` to choose `google` or `groq` for `/transcribe`
- `GOOGLE_AI_STUDIO_API_KEY` or Vertex credentials
- `GOOGLE_SPEECH_LOCATION` for voice transcription region overrides
- `GROQ_API_KEY`
- `FAL_API_KEY`
- search provider keys
- storage keys
- `ENCRYPTION_KEY`
- `R2_PUBLIC_BASE_URL` for model-facing attachment URLs
- `JWKS` optional but recommended; when set, Convex auth uses static JWKS instead
  of fetching `/api/auth/convex/jwks` on every deployment

If a feature looks configured in Vercel but still fails at runtime, check whether the actual key belongs in Convex instead.

## Docs

- [Setup Guide](./SETUP_GUIDE.md)
- [Model & Provider Guide](./MODEL_PROVIDER_GUIDE.md)
- [OAuth Setup](./OAUTH_SETUP.md)
- [BYOK Setup](./BYOK_SETUP.md)
- [Email Setup](./EMAIL_SETUP.md)
- [Voice Input Setup](./VOICE_INPUT_SETUP.md)
- [Convex README](./convex/README.md)

## Important Files

- `src/lib/auth.ts`: Better Auth config, cookie bridge, JWT/JWKS settings
- `src/routes/api/auth/$.ts`: auth route wrapper and stale-JWKS recovery
- `convex/auth.config.ts`: Convex JWT validation against Better Auth JWKS
- `convex/lib/models.ts`: built-in model registry
- `convex/lib/provider_factory.ts`: provider creation and OpenAI-compatible adapters
- `convex/chat_http/get_model.ts`: resolves a selected model into an SDK model
- `convex/chat_http/post.route.ts`: provider-specific reasoning options
- `convex/chat_http/image_generation.ts`: image model execution and provider quirks
- `src/lib/models-providers-shared.ts`: provider metadata and internal-provider visibility in the UI

## Current Internal Providers

The browser currently enables these internal providers by default:

```bash
VITE_ENABLED_INTERNAL_PROVIDERS="openai,google,xai"
```

Hidden providers like `groq` and `fal` are still supported, but they are not shown as normal internal-provider options in the UI.

If `OPENROUTER_API_KEY` is set in Convex, internal text models with an `openrouter:*` adapter will route through OpenRouter first while keeping the same app-level internal model identity. Image and speech flows still use their direct provider integrations.

## Current Model Notes

Recent built-in additions include:

- OpenAI: `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-image-1.5-2025-12-16`
- Google: `gemini-3-flash-preview`, `gemini-3.1-pro-preview`, `gemini-3.1-flash-lite-preview`, `gemini-3.1-flash-image-preview`, `gemini-3-pro-image-preview`, `imagen-4.0-*`
- xAI: `grok-4-1-*`, `grok-4.20-0309-*`

See [MODEL_PROVIDER_GUIDE.md](./MODEL_PROVIDER_GUIDE.md) for the rules behind those additions.

## Development Notes

- Use the local loop first. Do not debug auth or model changes by waiting on repeated Vercel builds unless the bug only reproduces in production.
- Better Auth and Convex are coupled through the proxied `/api/auth/*` surface, especially `/api/auth/convex/jwks`, so auth changes are never just a UI concern.
- `JWKS` is deployment-instance state, not per-push state. For the current
  staging deployment (`dev:knowing-falcon-519`), normal pushes remain just:

```bash
bun run staging:push
```
