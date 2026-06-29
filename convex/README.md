# Convex Runtime Notes

This folder is the application backend, not a stock Convex starter anymore.

## What Lives Here

- auth integration for Convex JWT validation
- chat HTTP streaming routes
- built-in model registry
- provider creation for OpenRouter chat routing
- BYOK settings and OpenRouter-hosted chat routing
- search, attachments, fal-backed image generation, and speech-to-text actions

## Key Files

- `auth.ts`: Convex-hosted Better Auth setup and current-user query
- `auth.config.ts`: Convex trusts Better Auth JWTs issued by the Convex site URL
- `lib/models.ts`: built-in model list and provider adapter mapping
- `lib/provider_factory.ts`: OpenRouter provider instance creation
- `chat_http/get_model.ts`: resolves model IDs into SDK model instances
- `chat_http/post.route.ts`: applies OpenRouter reasoning config and streams chat responses
- `lib/models/fal`: fal-backed image model definitions

## Commands

Run Convex locally:

```bash
bunx convex dev
```

Deploy Convex functions:

```bash
bunx convex deploy
```

Set a Convex environment variable:

```bash
bunx convex env set OPENROUTER_API_KEY your-key
```

List Convex environment variables:

```bash
bunx convex env list
```

## Auth Dependency

Convex auth depends on Better Auth:

- issuer: `process.env.CONVEX_SITE_URL`
- JWKS: `${process.env.CONVEX_SITE_URL}/api/auth/convex/jwks`
- application ID: `convex`

If Better Auth is broken, Convex auth is broken too.

### Static JWKS

This repo supports optional static JWKS via the `JWKS` Convex environment variable.
`JWKS` is per Convex deployment instance, not per code push.

Generate and store it with:

```bash
bunx convex run auth:rotateKeys | bunx convex env set JWKS
```

Do this when:

- setting up a brand new Convex deployment instance
- intentionally rotating Better Auth keys for an existing deployment

When `JWKS` is set, Convex auth verification and the Better Auth Convex plugin use it directly instead of fetching `/api/auth/convex/jwks`.

## Internal Provider Notes

Hosted chat models are controlled in two places:

1. Convex must have `OPENROUTER_API_KEY` configured.
2. The browser must include `openrouter` in `VITE_ENABLED_INTERNAL_PROVIDERS`.

That means OpenRouter can be configured in Convex and still stay hidden in the UI if the Vite env does not include it.

`OPENROUTER_API_KEY` is required for hosted built-in chat models. Legacy direct model keys such as OpenAI, Anthropic, Google model inference, xAI, and AI Gateway keys are not used by the built-in chat runtime. Image generation uses the fal-backed library generator, and speech-to-text may use Groq or Google depending on voice-input configuration.

## Where To Read More

- [Setup Guide](../SETUP_GUIDE.md)
- [Model & Provider Guide](../MODEL_PROVIDER_GUIDE.md)
- [BYOK Setup](../BYOK_SETUP.md)
