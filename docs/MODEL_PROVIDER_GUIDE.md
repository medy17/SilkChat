# Model & Provider Guide

This guide documents how built-in models are wired in this repo and what has to change when you add or update models.

## Core Concepts

### Built-in model registry

The model registry is assembled in:

```text
convex/lib/models.ts
```

Provider-specific arrays live in `convex/lib/models/*.ts`, and fal image descriptors live in `convex/lib/models/fal/*.ts`. Each entry defines:

- `id`: the app-facing model ID
- `name` and optional `shortName`
- `adapters`: provider identity and runtime targets like `i3-openai:gpt-4o`, `openai:gpt-4o`, `openrouter:openai/gpt-4o`, or `fal:fal-ai/...`
- optional `preferredOpenRouterProviders`: ordered inference provider preferences used only by the "Let SilkChat choose" routing mode; other providers remain eligible fallbacks
- `legacy`: keeps a callable model behind the legacy-model UI affordance
- `sunsetOn`: a `YYYY-MM-DD` date when the model stops being selectable and executable
- `replacementId`: the model id to use when a sunset model should migrate to a newer replacement
- `abilities`: feature flags used by the runtime and UI
- optional `mode`: `text`, `image`, `speech-to-text`, `text-to-speech`, or `decision`
- speech-to-text models declare `transcription.preferredFormat` and `transcription.acceptedFormats`; browser normalization and backend validation must consume this shared capability instead of embedding provider formats in either layer
- text-to-speech models declare `speech.voice`, `speech.preferredFormat`, `speech.pcm`, and `speech.maxInputCharacters`, and `speech.inputUsdPer1MCharacters`. The managed read-aloud model is `MESSAGE_SPEECH_MODEL` in the Microsoft registry. Keep speech models out of chat, retry, and persona model pickers.
- optional `supportedImageSizes`
- optional `customIcon`
- optional `useStrictCharts`: require every `render_chart` input field for models
  that omit required chart arrays with the normal optional display fields. Enabled
  on Grok chat entries; omit or set `false` to use the standard chart schema.
  This does not enable the provider's `strict` decoding flag or change saved charts.

### Text model short names

`shortName` is the compact, picker-facing identity of a text model. It should optimize
for recognition rather than satisfy a hard character limit: remove redundant branding,
but keep every part needed to distinguish the model from nearby entries.

General rules:

- Prefer a recognizable model-family token over the company name: `Claude Opus 5`
  becomes `Opus 5`, while `DeepSeek V4 Pro` becomes `V4 Pro`.
- Keep a family prefix when removing it would make the label ambiguous. Use `GLM 5.2`,
  `Grok 4.5`, `Qwen3.6 Plus`, and `MiMo V2.5 Pro`, not their bare versions.
- Keep meaningful product variants such as `Pro`, `Flash`, `Lite`, `Fast`, `Turbo`,
  `mini`, `nano`, `Omni`, `Sol`, and `Terra`.
- Keep a checkpoint when it distinguishes selectable releases or is conventionally part
  of the model's public identity. Otherwise treat it as release metadata and omit it.
- Remove deployment and implementation qualifiers such as `Instruct`, expert counts,
  and `Instant` unless they distinguish selectable entries.
- Do not invent opaque abbreviations merely to hit a length target. Aim for roughly 15
  characters, but allow a longer label when a necessary variant or checkpoint requires it.
- Every active text model must have a non-empty `shortName`, and text-model short names
  must be unique across the registry.

Family conventions:

- **OpenAI GPT:** remove `GPT`; use the number plus any variant (`5.5`, `5.6 Sol`,
  `4o-mini`). Hyphenate lowercase modifiers such as `mini`, `nano`, and `high`, while
  proper-name variants remain space-separated. Keep the complete identity of `o` models,
  such as `o4-mini-high`.
- **DeepSeek:** remove both `DeepSeek` and the invented `DS` abbreviation. Start with the
  public series token and retain meaningful variants or checkpoints (`V4 Pro`,
  `V4 Flash 0731`, `R1 0528`).
- **GLM:** retain `GLM` for plain numbered releases (`GLM 5.2`) because their timelines
  overlap other families. A distinctive suffixed model may omit it (`5V Turbo`).
- **Anthropic:** remove `Claude`; use class plus version (`Haiku 4.5`, `Fable 5`,
  `Opus 5`).
- **Kimi:** remove `Kimi`; keep the `K` series identity and any meaningful checkpoint
  (`K3`, `K2.6`, `K2 0905`).
- **Gemini:** remove `Gemini`; keep version and picker-facing tier (`3.6 Flash`,
  `3.1 Pro`). Collapse `Flash Lite` to `Lite` (`3.5 Lite`) and retain `Preview` only
  when it distinguishes the displayed model (`3.1 Lite Preview`).
- **Grok:** retain `Grok`, plus meaningful variants such as `Fast`. Omit a lone date
  checkpoint from the short name; add it only when needed to distinguish selectable
  releases (`Grok 4.20`, but `Grok 4.20 0309` if another 4.20 checkpoint is present).
- **Llama and Meta:** use codename plus active parameter size for codenamed Llama models
  (`Scout 17B`, `Maverick 17B`). For numbered models, retain `Llama`, version, and size
  (`Llama 3.1 8B`). Keep already-compact standalone names such as `Muse Spark 1.1`.
- **Qwen:** retain the `Qwen` family using its established compact styling
  (`Qwen3.6 Plus`).
- **MiMo:** retain `MiMo` because bare `V` labels would collide conceptually with other
  families (`MiMo V2.5 Pro`, `MiMo V2 Omni`).
- **MiniMax:** remove `MiniMax`; retain its recognizable `M` series token (`M3`, `M2.7`).

### Adapter prefixes

- `i3-openai:*`, `i3-anthropic:*`, `i3-google:*`, etc.: internal provider identity aliases used for metadata and grouping. Hosted execution resolves through the matching `openrouter:*` adapter.
- `openai:*`, `anthropic:*`, `google:*`, `xai:*`, etc.: user-provider identities used by settings and provider affordances. Built-in chat execution uses OpenRouter.
- `openrouter:*`: built-in chat/text runtime routing and dedicated speech-to-text routing. Production chat uses OpenRouter for hosted models and OpenRouter BYOK for user-provided keys.
- `fal:*`: library image generation through `convex/lib/models/fal` and the fal client.

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

Edit the matching provider module under `convex/lib/models/` and define:

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

Only change `convex/lib/provider_factory.ts` or `convex/chat_http/get_model.ts` if the provider changes the supported chat runtime transports. Image generation uses the shared fal job system from the library and chat tool.

## Provider-Specific Notes

### OpenRouter

- hosted chat/text models use `OPENROUTER_API_KEY`
- user BYOK chat/text models use the user's OpenRouter key
- OpenRouter attribution headers and app metadata are applied in `convex/lib/provider_factory.ts`
- built-in chat does not read direct OpenAI, Anthropic, Google model-inference, xAI, or AI Gateway keys
- `preferredOpenRouterProviders` supplies curated provider preferences. There are no unconditional provider pins.

### User-selected model routing

Privacy settings store `modelRouting: "silkchat" | "zdr" | "floor"`; missing values use `silkchat`.
`convex/lib/model_routing.ts` owns the shared policy:

- `silkchat`: prefer the registry's ordered providers, allowing other providers as fallbacks.
- `zdr`: require OpenRouter's `provider.zdr: true`, with no curated provider restriction.
- `floor`: append `:floor` only to the outbound model slug. This admits default and discounted flex endpoints, including ZDR endpoints, without curated ordering. App model IDs remain stable.

`get_model.ts` sets routing on the SDK model so background title/share-question generation inherits it. Chat also sends the same policy alongside its reasoning and session options. Hosted-to-BYOK retries retain the request's settings snapshot. Custom OpenAI-compatible connections, fal images, voice, and external tools are outside this setting's guarantee; it does not change SilkChat's saved history.

The metadata sync reads the model catalog, each registered chat model's endpoints, and `/api/v1/endpoints/zdr`. Endpoint tags identify service tiers (`/flex`, `/fast`, `/priority`); default requests do not admit those tiers unless explicitly selected. ZDR is joined by exact model ID and endpoint tag. Endpoint listings are sync-time inputs only. `modelProviderMetadata.routing` stores compact `silkchat`, `zdr`, and `floor` summaries with availability, paired price estimates, capacity limits, and refresh timestamps. Endpoint prices already reflect the advertised tier; do not apply a second discount. Zero is a valid price.

The frontend receives compact summaries without endpoint arrays. Both model menus keep models with no eligible providers visible but disabled, including favorites. Missing price data alone does not disable a model. Failed refreshes retain the last successful snapshot for each mode; a successful empty listing records unavailability. Runtime ZDR enforcement remains OpenRouter's responsibility even when a snapshot is stale. Account/key guardrails can further restrict runtime eligibility.

Prices are estimates from one eligible endpoint, using paired input/output rates and curated preference order where applicable. Actual request composition, caching, service tiers, and fallbacks affect settlement. Hosted usage settles against OpenRouter's reported charge, preserving zero-cost discounts; BYOK's upstream-cost reporting remains separate.

### Custom OpenAI-compatible providers

User-defined custom providers resolve from stored provider settings. They are OpenAI-compatible chat endpoints outside the built-in provider catalog.

### fal image models

Built-in image models are defined under `convex/lib/models/fal` and use `fal:*` adapters consumed by the library generator and chat image tool.

### OpenRouter decision models

Decision models use `mode: "decision"` and stay out of chat, retry, and persona model pickers.
`convex/lib/models/typesafe.ts` registers Jev and selects the opening-skill classifier.
`convex/lib/classifiers.ts` defines typed questions and answers and calls OpenRouter's
`/api/alpha/decisions` endpoint with the hosted `OPENROUTER_API_KEY`, app attribution,
and the user's routing policy. No TypeSafe key or chat-completion adapter is needed.

Opening skill selection runs only when the message mutation reports actual thread creation
and the composer's Magic toggle is enabled. Magic defaults on and persists in the browser. New Magic conversations start with individual tools off; with Magic off they restore saved manual preferences. Automatic choices live separately in conversation state and never update the manual preset. The opening selection, including completion/failure status, is saved on the thread and reused by retries and reconnects. Browser conversation overrides preserve later manual edits; background streams cannot replace the active conversation's tools.
Creation is never inferred from message count or an absent request thread ID alone. It does not run on retries,
edits, replayed requests, or subsequent turns. One batched request has a 5-second timeout
to allow connection setup on the opening request.
Opening-skill calibration lives in each decision model's `skillSelection` registry field: per-skill `thresholds` and `prohibitionThresholds` for browsing and execution. A classifier used for opening selection must supply its own complete calibration; there is no fallback to Jev values. Tool-need criteria and the maximum-of-independent-needs rule remain application logic. Jev executable skills currently require Noul scores of at least 0.85. Presentation-only diagrams, recipes, and canvas instructions use 0.75 to accommodate implicit output requests. These scores are classifier outputs, not calibrated guarantees.
Selection receives the current UTC date, the chat model's known cutoff, and each skill's availability category.
Selection considers all tools allowed by deployment credentials, identity policy, and model capabilities, including tools that are off by default. It enables confident selections while preserving manually enabled tools. The stream returns added abilities to the composer so later turns and retries retain them without reclassifying. Explicit requests not to use a tool still prevent its automatic selection.
Each skill has explicit classifier criteria describing the work it supports and exclusions; chat-model skill summaries are not used as classifier instructions. Web search uses separate judgments for explicit requests, current facts, facts after the cutoff, external records needed for analysis, and instructions not to browse. Code execution separately evaluates general runtime needs and dataset computation, including data that must first be retrieved, with an explicit prohibition check. Math Kit separately evaluates requested plots and networks so simple plots are not rejected for lacking complex mathematics. Any positive need must meet the search threshold, and a
prohibition probability of 0.5 or higher prevents automatic preloading.
These are initial thresholds, not measured accuracy guarantees. Missing classifier credentials or classifier failures make eligible non-Memory tools available for on-demand skill loading without preloading any skill. Memory stays inactive unless it was already enabled or a successful classification selects it. This fallback is saved on the thread and still respects deployment credentials and identity policy. Failed selections defer tool-budget reservation until an executable tool is called, so a direct answer does not reserve tool usage. A rejected tool budget rolls back an untouched opening created by that request. Preloaded instructions must fit the existing context limits.
The classifier is hosted orchestration overhead, like title generation, and is not a user tool call.

Run `bun scripts/evals/opening-skills.ts` for an opt-in live Jev evaluation across all eight skills. It uses the hosted key, makes no chat-model calls, and reports scores plus required and forbidden selections. Ambiguous requests are marked exploratory rather than assigned an exact expected tool set. Use `--filter=polar --repeat=7` to repeat one case; `--output` selects the JSON report path.

### OpenRouter speech-to-text

Speech-to-text uses OpenRouter's dedicated transcription API and the same OpenRouter credential precedence as hosted chat. Speech models retain `mode: "speech-to-text"` so chat and persona selectors can exclude them.

### OpenRouter text-to-speech

Assistant read-aloud uses the existing R2 ingest worker's `/speech` endpoint and OpenRouter's `/audio/speech`. Convex only authorizes the message, prepares spoken text, signs a single-use playback ticket, and synchronizes completed R2 metadata. The worker obtains the app's OpenRouter credentials through a signed server-to-server callback using the existing ingest secret. Credentials never reach the browser. New recordings reserve and settle hosted usage through the existing credit system under the `speech` feature. Cached playback is free, including the Worker’s R2 fallback when Convex metadata is missing. Failures before synthesis release the reservation; failures or cancellations after a provider accepts input settle the submitted characters or UTF-8 bytes. Each generation lease has an independent billing key, with idempotent settlement and a one-shot timeout to release abandoned reservations. BYOK is not used.

The browser schedules incoming PCM immediately. The worker saves WAV audio directly to R2 with multipart uploads under `generations/{userId}/{fingerprint}-speech.wav`, holding at most two upload parts in memory. Completed recordings replay directly from signed R2 URLs. The fingerprint includes the user, thread, message, spoken text, and speech configuration. Incomplete uploads are aborted. Finished assets follow existing generated-file management and account deletion. No asset cleanup cron or Convex audio proxy is involved.

`convex/lib/speech_config.ts` derives model capabilities from the Microsoft registry. Provider requests are split at text boundaries according to the configured model's input size. There is no app audio-size or total-text-length cap. A 15-minute generation timeout bounds abandoned work, and a recoverable lease in the existing rate-limit table prevents simultaneous generations for one user. Speech pricing declares either `inputUsdPer1MCharacters` or `inputUsdPer1MUtf8Bytes`; Fish uses UTF-8 bytes. `speech.auditionVoices` stores the managed developer shortlist. An omitted `speech.voice` requests the provider default. Flux, Fish S2.1 Pro, Orpheus, and Grok Voice are registered audition candidates; MAI + Harper remains active. Candidate PCM settings come from provider documentation and still need an OpenRouter playback audition before activation. Orpheus reserves at the catalog rate of $15/M characters; its DeepInfra route may be cheaper.

Character pricing lives in the Microsoft registry and is excluded from the audio fingerprint, so pricing changes preserve cached recordings. Bump the speech configuration version when changing extraction rules that should invalidate previous audio.

## Reasoning Control Rules

Reasoning controls are applied in `convex/chat_http/post.route.ts`.

Current chat mapping is OpenRouter-only: the app-level `off|low|medium|high` setting maps to OpenRouter's `reasoning.effort`.

## Image Model Rules

Image models must set:

- `mode: "image"`
- `supportedImageSizes`

Runtime image generation flows through the shared fal queue/job system from both the library and chat image tool, with model definitions under:

```text
convex/lib/models/fal
```

The chat model selector rejects image models; chat can invoke image generation through its tool. If a fal endpoint needs special input mapping, update its fal descriptor and shared image-generation path.

## Model Examples

Built-in models following this pattern include:

- OpenAI:
  - `gpt-5.4`
  - `gpt-5.4-mini`
  - `gpt-5.4-nano`
  - `gpt-5.4-image-2`
  - `gpt-5-image`
- Google:
  - `gemini-3-flash-preview`
  - `gemini-3.1-pro-preview`
  - `gemini-3.1-flash-lite`
  - `gemini-3.1-flash-image-preview`
  - `gemini-3.1-flash-lite-image`
  - `gemini-3-pro-image-preview`
- xAI:
  - `grok-4.5`
  - `grok-4.3`
  - `grok-4-1-fast`
  - `grok-4.20-0309`

## Testing Checklist

Before pushing model/provider changes:

1. confirm the model appears in the selector
2. confirm the provider is actually enabled
3. test one real request locally
4. test reasoning if the model supports `effort_control`
5. test library image generation if `mode: "image"`
6. run `bun run check-types` and `bun run test`
7. use the synchronized staging or production deploy command from the matching branch

## Common Failure Modes

- model added to `MODELS_SHARED` but provider not exposed in the UI
- OpenRouter enabled in the UI but `OPENROUTER_API_KEY` missing from Convex env
- image model added without a matching fal endpoint adapter
- reasoning model added without `effort_control`, so the UI/runtime never sends reasoning settings
- OpenRouter-backed model added but omitted from `VITE_ENABLED_INTERNAL_PROVIDERS` or the relevant `openrouter-*` visibility alias


## Writing Model Descriptions for a Model Picker

### Purpose
Write concise, non-generic descriptions that help users pick the right model. Each description conveys **what the model is**, **how it was built**, **what improved**, and **what it excels at** without leaning on tired phrasing or referential comparisons.

### Core Principles

**1. Anchor with a natural starting point.**
Open with the provider and the model's identity ("xAI's latest multimodal model entry…", "xAI's latest entry built with…", "OpenAI's previous generation..."). Don't start mid-thought or with a bare gerund — it reads as clipped and unnatural. The opening should orient the user before diving into detail.

**2. State what the model *is*.**
Classify it plainly: new entry, new base, fine-tune, pre-train, checkpoint, supplemental run, etc. This tells users the nature of the release, not just its behavior.

**3. Name the techniques, not the outcomes.**
Reference the actual methods used — supplemental training runs, limited release, regenerated SFT trajectories, model-based filtering, RL across specific environments. Specificity is the antidote to generic writing.

**4. Avoid the clichés.**
Ban phrases like "built for agentic tasks," "for long-horizon coding," "built on top of Y," or "X vs Y." These describe every model and distinguish none. Describe the *actual* behavior instead ("sustains focus across many steps," "self-tests before proceeding"). 

**5. Keep it non-referential.**
Don't define the model by its predecessor or competitors. Describe it on its own terms. "Trained longer and more carefully than before" is acceptable framing; "builds on Grok 4.5" is not.

**6. Never cite evals or scores.**
The UI already renders benchmarks visually. Repeating numbers is redundant and wastes your character budget.

**7. Updating nearby models**
When a new model is released, the tenses in the descriptions of the lab's previous releases may need to be updated so check them.
E.g. If adding GPT 6.7 Ultra, 6.6 Ultra may need to be changed from "OpenAI's latest flagship model for multi-agentic workflows" to "OpenAI's previous generation flagship for multi-agentic workflows."
The idea is for descriptions to not contradict each other or clash.


**7. Length**
- **short**: ~20 words. One dense sentence — identity + one or two standout strengths.
- **default**: ~70 words, max 400 chars. Three-beat structure works well: (1) what it is + how it was made, (2) behavioral traits, (3) what it specifically excels at. 
- Neither of these are minimums however. That should be inferred from other model entries.

## Structural Template (long form)
1. **Identity + method** — who made it, what it is, and the key technique(s).
2. **Behavior** — concrete traits users will feel in practice.
3. **Sweet spot** — the specific kind of work where it shines, phrased precisely.

### Tone Checklist
- Specific over sweeping.
- Concrete verbs over buzzwords.
- Self-contained, not comparative.
- Confident, not hype-y — no superlatives it can't back up in plain terms.
