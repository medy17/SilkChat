# BYOK (Bring Your Own Key) Setup

This app supports both:

- an internal OpenRouter key managed by the deployment
- user BYOK keys stored per account

User BYOK keys are encrypted before storage and decrypted only at runtime.

## Required Encryption Variable

Set this in Convex:

```bash
ENCRYPTION_KEY=your_random_secret
```

Use a long random value. Do not reuse an example value.

## Supported BYOK Providers

Production chat BYOK is OpenRouter-only:

- `openrouter`

Direct OpenAI, Anthropic, Google, xAI, and Groq provider identities may still exist in settings or registry metadata for compatibility. Built-in production chat runtime uses OpenRouter for hosted models and OpenRouter BYOK for user-provided keys.

## Internal Provider Environment Variables

These belong in Convex, not Vercel:

```bash
OPENROUTER_API_KEY=

# speech-to-text only
GROQ_API_KEY=

# library image generation only
FAL_KEY=
```

`OPENROUTER_API_KEY` is required for hosted built-in chat models. Legacy direct inference keys such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, Google model keys, `XAI_API_KEY`, and `AI_GATEWAY_API_KEY` are not used by the built-in chat runtime. Image generation uses fal through the library generator. Speech-to-text may use Groq depending on voice-input configuration.

## How Provider Resolution Works

When a model is selected, the runtime resolves providers in this order:

1. matching user OpenRouter BYOK key
2. matching internal OpenRouter key
3. custom OpenAI-compatible provider settings for custom models
4. failure if no supported runtime is available

For built-in models, the available adapter list lives in `convex/lib/models.ts`.

## Where Provider Visibility Comes From

Two checks control whether hosted built-in chat models are visible and usable:

1. Convex must have `OPENROUTER_API_KEY`.
2. `VITE_ENABLED_INTERNAL_PROVIDERS` must include `openrouter`.

That means OpenRouter can be configured in Convex and still hidden in the UI.

## Security Notes

- Never commit provider keys.
- Never store user BYOK secrets in plain text.
- Rotate `ENCRYPTION_KEY` carefully. If you change it, previously encrypted stored keys will become unreadable.

## Related Docs

- [Model & Provider Guide](./MODEL_PROVIDER_GUIDE.md)
- [Setup Guide](./SETUP_GUIDE.md)
