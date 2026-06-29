# Model & Provider Guide

This guide documents how built-in models are wired in this repo and what has to change when you add or update models.

## Core Concepts

### Built-in model registry

Built-in models live in:

```text
convex/lib/models.ts
```

Each entry defines:

- `id`: the app-facing model ID
- `name` and optional `shortName`
- `adapters`: provider identity and runtime targets like `i3-openai:gpt-4o`, `openai:gpt-4o`, `openrouter:openai/gpt-4o`, or `fal:fal-ai/...`
- `legacy`: marks an older model that remains callable but should be hidden behind legacy UI affordances
- `sunsetOn`: a `YYYY-MM-DD` date when the model stops being selectable and executable
- `replacementId`: the model id to use when a sunset model should migrate to a newer replacement
- `abilities`: feature flags used by the runtime and UI
- optional `mode`: `text`, `image`, or `speech-to-text`
- optional `supportedImageSizes`
- optional `customIcon`

### Adapter prefixes

- `i3-openai:*`, `i3-anthropic:*`, `i3-google:*`, etc.: legacy internal provider identity aliases. Built-in chat no longer executes these providers directly; when an internal hosted model is selected, it resolves through the matching `openrouter:*` adapter.
- `openai:*`, `anthropic:*`, `google:*`, `xai:*`, etc.: user-provider identities used by settings and legacy/direct-provider affordances. Built-in chat does not use these directly unless legacy direct inference is explicitly re-enabled.
- `openrouter:*`: built-in chat/text runtime routing. Production chat uses OpenRouter for hosted models and OpenRouter BYOK for user-provided keys.
- `fal:*`: library image generation through `convex/lib/models/fal` and the fal client.
- `groq:*`: Groq identity; currently used for speech-to-text and legacy/direct-provider metadata.

Built-in chat/text execution is routed through `openrouter:*` adapters. Keep provider-specific adapter aliases only when they are needed for provider identity, grouping, settings, or stored preferences.

### Abilities

Common abilities:

- `reasoning`
- `effort_control`
- `vision`
- `function_calling`
- `pdf`

These flags are not decorative. They change runtime behavior.

## How To Add A Built-In Model

### 1. Add the model entry

Edit `convex/lib/models.ts` and define:

- the model ID
- adapters
- abilities
- mode if it is not normal text
- supported sizes if it is an image model

### 2. Check provider support

For chat/text models, keep the provider identity adapters and add an `openrouter:*` adapter when the model should run through hosted OpenRouter. For image models, add a `fal:*` adapter under `convex/lib/models/fal` and make sure the library image generator supports the endpoint shape.

### 3. Check OpenRouter visibility

If the model uses hosted built-in chat, make sure:

- the model has an `openrouter:*` adapter
- Convex has `OPENROUTER_API_KEY`
- `VITE_ENABLED_INTERNAL_PROVIDERS` includes `openrouter` or the relevant `openrouter-*` visibility alias
- the UI knows how to display the provider/developer in `src/lib/models-providers-shared.ts`

### 4. Check UI provider metadata

If the provider is new, also update:

- `src/components/brand-icons.tsx`
- `src/components/model-selector.tsx`
- `src/lib/models-providers-shared.ts`

## How To Add A New Provider

For built-in chat/text providers, preserve provider identity in the registry and add OpenRouter runtime routing when the provider should be available in production. You usually need to touch:

1. `convex/lib/models.ts`
2. `src/lib/models-providers-shared.ts`
3. provider icons in the UI

Only change `convex/lib/provider_factory.ts` or `convex/chat_http/get_model.ts` if the provider changes the supported runtime transports. Image generation is handled separately through fal-backed library models, not through chat.

## Provider-Specific Notes

### OpenRouter

- hosted chat/text models use `OPENROUTER_API_KEY`
- user BYOK chat/text models use the user's OpenRouter key
- OpenRouter attribution headers and app metadata are applied in `convex/lib/provider_factory.ts`
- legacy direct inference keys such as OpenAI, Anthropic, Google model inference, xAI, and AI Gateway keys are not used for built-in chat runtime

### Custom OpenAI-compatible providers

User-defined custom providers can still be resolved from stored provider settings. They are treated as OpenAI-compatible chat endpoints and are not part of the built-in provider catalog.

### fal image models

Image generation lives outside chat. Built-in image models are defined under `convex/lib/models/fal` and use `fal:*` adapters consumed by the fal client.

### Groq speech-to-text

Groq remains supported for speech-to-text paths. Do not add Groq chat adapters unless the production provider policy changes.

## Reasoning Control Rules

Reasoning controls are applied in `convex/chat_http/post.route.ts`.

Current chat mapping is OpenRouter-only: the app-level `off|low|medium|high` setting maps to OpenRouter's `reasoning.effort`.

## Image Model Rules

Image models must set:

- `mode: "image"`
- `supportedImageSizes`

Runtime image generation flows through the library image generator and fal client, with model definitions under:

```text
convex/lib/models/fal
```

Chat rejects image models. If a fal endpoint needs special input mapping, patch the fal-backed image generation path rather than the chat route.

## Current Recent Additions

Recent built-in additions that already follow this pattern:

- OpenAI:
  - `gpt-5.4`
  - `gpt-5.4-mini`
  - `gpt-5.4-nano`
  - `gpt-image-1.5-2025-12-16`
- Google:
  - `gemini-3-flash-preview`
  - `gemini-3.1-pro-preview`
  - `gemini-3.1-flash-lite-preview`
  - `gemini-3.1-flash-image-preview`
  - `gemini-3-pro-image-preview`
  - `imagen-4.0-generate-001`
  - `imagen-4.0-ultra-generate-001`
  - `imagen-4.0-fast-generate-001`
- xAI:
  - `grok-4-1-fast`
  - `grok-4.20-0309`

## Testing Checklist

Before pushing model/provider changes:

1. confirm the model appears in the selector
2. confirm the provider is actually enabled
3. test one real request locally
4. test reasoning if the model supports `effort_control`
5. test library image generation if `mode: "image"`
6. deploy Convex for backend/runtime changes
7. deploy Vercel only if the browser app or app env changed

## Common Failure Modes

- model added to `MODELS_SHARED` but provider not exposed in the UI
- OpenRouter enabled in the UI but `OPENROUTER_API_KEY` missing from Convex env
- image model added without a matching fal endpoint adapter
- reasoning model added without `effort_control`, so the UI/runtime never sends reasoning settings
- OpenRouter-backed model added but omitted from `VITE_ENABLED_INTERNAL_PROVIDERS` or the relevant `openrouter-*` visibility alias
