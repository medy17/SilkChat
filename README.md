# SilkChat

SilkChat is a TanStack Start and Convex chat application with Better Auth, hosted and BYOK models, resumable streaming, file imports and uploads, web search, personas, usage metering, and fal-backed image generation.

## Repository Layout

- `src/`: TanStack Start application, server routes, UI, hooks, and browser state
- `convex/`: Better Auth, chat runtime, models, tools, billing, storage, and scheduled jobs
- `tests/`: Vitest coverage grouped by backend, routes, components, hooks, imports, and libraries
- `scripts/`: local-development, environment-sync, and deployment helpers
- `envs/`: ignored, target-specific environment files used by the scripts

## Quick Start

Requirements: Bun (the version is pinned in `package.json`) and access to a Convex deployment.

1. Install dependencies:

```bash
bun install
```

2. Copy `.env.example` to `envs/.env.local` and fill in the app values you need.

3. Create `envs/.env.cloud-dev`:

```bash
CLOUD_DEV_CONVEX_DEPLOYMENT="dev:your-cloud-dev-deployment"
CLOUD_DEV_CONVEX_URL="https://your-deployment.convex.cloud"
CLOUD_DEV_CONVEX_API_URL="https://your-deployment.convex.site"
CLOUD_DEV_CONVEX_SITE_URL="https://your-deployment.convex.site"
VITE_R2_PUBLIC_BASE_URL="https://your-public-r2-host"
```

4. Start the app:

```bash
bun run dev
```

This starts Vite at `http://localhost:3000` and the local Sharp image optimizer. Its
terminal controls can sync Convex, restart individual services, clear the optimizer
cache, or restart the whole local stack without stopping `bun run dev`. When
`DEV_PUBLIC_URL` and `CLOUDFLARE_TUNNEL_TOKEN` are configured, it also starts the
named Cloudflare Tunnel for HTTPS and mobile-device access. It does not push local
Convex changes automatically; press `b` (Sync Backend) in the runner or use this command when backend
or schema changes need to reach cloud dev:

```bash
bun run cloud:dev:push
```

See [Setup Guide](./docs/SETUP_GUIDE.md) for environment and deployment details.

## Common Commands

```bash
bun run dev                 # Vite + local image optimizer against cloud dev
bun run cloud:dev:push      # push local Convex code to cloud dev
bun run check-types         # TypeScript validation
bun run test                # one-shot Vitest suite
bun run build               # production frontend build
bun run lint                # Biome check with writes
bun run staging:deploy      # verify, deploy Convex staging, push staging branch
bun run prod:deploy         # verify, deploy Convex production, push main branch
```

Do not use `bun test`; the canonical test command is `bun run test`.

The synchronized deploy commands require a clean worktree and the matching branch (`staging` or `main`). Use `staging:push` and `prod:push` only for an explicitly intended Convex-only or manual deployment operation.

## Environment Ownership

The app/Vercel runtime needs browser and server-proxy values such as:

- `VITE_CONVEX_URL`
- `VITE_CONVEX_API_URL`
- `VITE_CONVEX_SITE_URL`
- `VITE_ENABLED_INTERNAL_PROVIDERS`
- `VITE_ENABLE_VOICE_INPUT`
- analytics and checkout URL variables
- outbound email variables

Convex owns backend secrets and runtime configuration such as:

- `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and optional `JWKS`
- `VITE_BETTER_AUTH_URL` and `VITE_CONVEX_SITE_URL` used by Convex-hosted Better Auth
- `OPENROUTER_API_KEY` and `ENCRYPTION_KEY`
- speech-to-text, search, fal, storage, billing, and usage-metering variables
- `IDENTITY_FINGERPRINT_PEPPER` for account-deletion tombstones

`envs/.env.convex` is the shared source for Convex environment values. Target overrides live in:

- `envs/.env.convex.cloud-dev`
- `envs/.env.convex.staging`
- `envs/.env.convex.production`

Push them with the matching `env:convex:*:push` script. Environment files contain secrets and must not be committed.

## Providers

Hosted built-in chat models use OpenRouter. Convex must have `OPENROUTER_API_KEY`, and the browser must expose the desired groups through `VITE_ENABLED_INTERNAL_PROVIDERS`.

User BYOK chat is OpenRouter-based. Image generation uses native fal queue/webhook APIs, while speech-to-text can use Google or Groq. Provider identity metadata supports grouping and stored preferences independently of runtime routing.

## Documentation

- [Setup and deployment](./docs/SETUP_GUIDE.md)
- [OAuth and auth](./docs/OAUTH_SETUP.md)
- [Models and providers](./docs/MODEL_PROVIDER_GUIDE.md)
- [BYOK](./docs/BYOK_SETUP.md)
- [Image generation](./docs/IMAGE_GENERATION.md)
- [Composer intent guide](./docs/COMPOSER_INTENTS.md)
- [Voice input](./docs/VOICE_INPUT_SETUP.md)
- [Email](./docs/EMAIL_SETUP.md)
- [Account deletion](./docs/ACCOUNT_DELETION.md)
- [Testing overview](./docs/TESTING.md) and [test-writing guide](./docs/TEST_WRITING_GUIDE.md)
- [Dev tools](./docs/DEV_TOOLS_GUIDE.md)
- [Font styling](./docs/FONT_STYLING_WORKFLOW.md)
- [Convex runtime notes](./convex/README.md)

## Important Files

- `src/lib/auth-server.ts`: TanStack Start bridge to Convex-hosted Better Auth
- `src/routes/api/auth/$.ts`: stable `/api/auth/*` proxy and GET coalescing
- `convex/auth.ts`: Better Auth configuration and account-restoration triggers
- `convex/auth.config.ts`: Convex JWT validation configuration
- `convex/lib/models.ts`: built-in model registry
- `convex/lib/models/fal/`: fal image-model descriptors
- `convex/lib/provider_factory.ts`: OpenRouter and custom OpenAI-compatible providers
- `convex/chat_http/get_model.ts`: selected-model resolution
- `convex/chat_http/post.route.ts`: chat validation, tools, metering, and streaming
- `convex/image_generation_jobs.ts`: durable image-generation job state and recovery
- `convex/account_deletion.ts`: resumable account-deletion workflow
