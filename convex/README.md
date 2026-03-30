# Convex Runtime Notes

This folder is the application backend, not a stock Convex starter anymore.

## What Lives Here

- auth integration for Convex JWT validation
- chat HTTP streaming routes
- built-in model registry
- provider creation for OpenAI, Anthropic, Google, xAI, Groq, fal, and OpenRouter
- BYOK settings and internal-provider fallback logic
- search, attachments, image generation, and speech-to-text actions

## Key Files

- `auth.config.ts`: Convex trusts Better Auth JWTs from `VITE_BETTER_AUTH_URL`
- `lib/models.ts`: built-in model list and provider adapter mapping
- `lib/provider_factory.ts`: provider instances, including OpenAI-compatible Google image support and xAI
- `lib/internal_provider_config.ts`: determines whether an internal provider is actually configured
- `chat_http/get_model.ts`: resolves model IDs into SDK model instances
- `chat_http/post.route.ts`: applies provider-specific reasoning config
- `chat_http/image_generation.ts`: image generation execution and aspect-ratio handling

## Commands

Run Convex locally:

```bash
bunx convex dev
```

Deploy Convex functions:

```bash
npx convex deploy
```

Set a Convex environment variable:

```bash
npx convex env set OPENAI_API_KEY your-key
```

List Convex environment variables:

```bash
npx convex env list
```

## Auth Dependency

Convex auth depends on Better Auth:

- issuer: `process.env.VITE_BETTER_AUTH_URL`
- JWKS: `${process.env.VITE_BETTER_AUTH_URL}/api/auth/jwks`
- application ID: `intern3`

If Better Auth is broken, Convex auth is broken too.

## Internal Provider Notes

Internal providers are controlled in two places:

1. Convex must have the actual secret configured.
2. The browser must allow the provider in `VITE_ENABLED_INTERNAL_PROVIDERS`.

That means a provider can be configured in Convex and still stay hidden in the UI if the Vite env does not include it.

If `OPENROUTER_API_KEY` is configured, internal text models that also define `openrouter:*` adapters can execute through OpenRouter while still appearing to the rest of the app as normal internal models. Image and speech paths still use their direct provider integrations.

## Where To Read More

- [Setup Guide](../SETUP_GUIDE.md)
- [Model & Provider Guide](../MODEL_PROVIDER_GUIDE.md)
- [BYOK Setup](../BYOK_SETUP.md)
