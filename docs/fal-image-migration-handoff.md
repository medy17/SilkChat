# fal.ai Image Generation Migration Handoff

## Context

SilkChat/SilkScreen image generation now routes through the library image generator and native fal.ai client. The old chat image-generation route was removed after the fal path became the source of truth.

The migration target is native fal.ai, using the official `@fal-ai/client` queue/webhook APIs. Do not use the existing `@ai-sdk/fal` integration; it is legacy and should be removed as part of the migration.

Relevant current files:

- `convex/images_node.ts`: standalone library image action, credits, generated image insertion.
- `convex/chat_http/get_model.ts`: chat/text registry adapter resolution.
- `convex/lib/provider_factory.ts`: OpenRouter chat provider wiring.
- `convex/lib/models.ts` and `convex/lib/models/*`: shared model metadata used by backend and UI.
- `convex/lib/models/fal/*`: fal endpoint-backed image model definitions.
- `src/components/library/image-generation-sidebar.tsx`: image model selection, references, aspect ratio/resolution controls, generation submission.
- `convex/images.ts` and `convex/schema/generated_image.ts`: generated image rows, facets, filters.

## First-Pass Implementation Status

Implemented in this branch:

- Added native `@fal-ai/client` dependency and removed `@ai-sdk/fal`.
- Replaced the standalone library real-generation path with `fal.queue.submit(..., { webhookUrl })`.
- Added `/webhooks/fal` to finalize queue jobs, store returned images, and commit or release reserved credits by semantic result.
- Added `/upload/reference`, storing image-only references under `references/{userId}/...`.
- Added client-side current-reference SHA-256 reuse so repeated Generate clicks do not reupload unchanged current references.
- Added `imageGenerationJobs` for server-backed pending state and webhook idempotency by `falRequestId`.
- Added `referenceImageKeys`, `generationJobId`, and `falRequestId` to generated image rows.
- Removed the synchronous chat image path after the fal library path was validated.
- Changed internal fal availability to use `FAL_KEY`.

Validated against current fal endpoint schemas during the first pass:

- `gpt-5.4-image-2` maps to `openai/gpt-image-2` and `openai/gpt-image-2/edit`; `image_size` must be an object or supported enum, not `"720x1280"` strings.
- `gpt-5-image-mini` maps to `fal-ai/gpt-image-1-mini` and `/edit`; `image_size` is an enum string such as `1024x1024`, `1536x1024`, or `1024x1536`.
- `gpt-5-image` maps to `fal-ai/gpt-image-1.5` and `/edit`; `image_size` is an enum string such as `1024x1024`, `1536x1024`, or `1024x1536`. SilkChat exposes `16:9` and `9:16` as UI aliases to fal's landscape/portrait enum values.
- `gemini-2.5-flash-image` maps to `fal-ai/nano-banana` and `/edit`, with `aspect_ratio` and `safety_tolerance`; this endpoint supports `21:9` but does not take the newer Nano Banana 2 `resolution` field.
- `gemini-3.1-flash-image-preview` maps to `fal-ai/nano-banana-2` and `/edit`, with `aspect_ratio`, uppercase `resolution`, and `safety_tolerance`; this endpoint supports `21:9`.
- `gemini-3-pro-image-preview` maps to `fal-ai/gemini-3-pro-image-preview` and `/edit`, with `aspect_ratio`, uppercase `resolution`, and `safety_tolerance`.
- `grok-imagine-image` maps to `xai/grok-imagine-image` and `/edit`, with `aspect_ratio` and lowercase `resolution`; no safety fields.
- `grok-imagine-image-pro` maps to `xai/grok-imagine-image/quality/text-to-image` and `/quality/edit`; no separate `xai/grok-imagine-image-pro` fal endpoint was found.
- `flux-2-flex` maps to `fal-ai/flux-2-flex`; fal currently exposes text-to-image only, so references must be rejected or the UI metadata must stop advertising them for this route.
- `seedream-4-5` maps to `fal-ai/bytedance/seedream/v4.5/text-to-image` and `/edit`; it uses `image_size`, `max_images`, and `enable_safety_checker`, not `aspect_ratio`, `resolution`, or `safety_tolerance`. `21:9` is sent as a custom `{ width, height }` image size.

Still needs follow-up:

- Decide whether to add a stuck-job recovery poller if webhook delivery fails.
- Decide how to reconcile Flux 2 Flex reference support in app metadata with fal's text-to-image-only endpoint.

## Non-Negotiables

- Use `bun`. Do not use npm.
- Do not run the dev server unless explicitly asked.
- Preserve in-app model IDs in `generatedImages.modelId`; do not store fal endpoint IDs there.
- Use official fal env naming: `FAL_KEY`.
- Do not use `@ai-sdk/fal` for the new path.
- Reference upload dedupe is client-session scoped only. Do not scan R2 or DB for hashes.
- fal requests should include `enable_safety_checker: false` for endpoints that accept it.
- For models that accept `safety_tolerance`, pass the lowest strictness value, generally `"1"`, descriptor-controlled.

## Historical Provider-Specific Behavior

The removed chat generator had several passthrough behaviors. Keep this section as historical context when comparing old outputs to fal model descriptors:

- OpenAI/Gateway image models map app aspect ratio plus `1K`/`2K`/`4K` to concrete pixel sizes.
- OpenAI paths pass model default quality where configured.
- Gateway OpenAI path passes `moderation: "low"` and `quality`.
- OpenAI reference-image path uses the Responses image tool and sends input images with low detail.
- Google Vertex path sends references as inline data, uses `responseModalities`, `imageConfig.aspectRatio`, `imageConfig.imageSize`, PNG output, and disabled/low safety settings.
- Google OpenAI-compatible path passes `extra_body.google.aspect_ratio`.
- OpenRouter image path passes `modalities`, `image_config.aspect_ratio`, `image_config.image_size`, `image_config.quality`, safety settings, and provider pinning for some models.
- xAI direct path chooses generation vs edit endpoint based on references, sends a single reference as `image`, multiple references as `images`, passes `aspect_ratio`, `resolution`, `n`, and requests base64 output.
- UI currently has an xAI-specific warning for single-reference edits preserving source aspect ratio; this should become metadata-driven rather than adapter-sniffed.

## Proposed Architecture

### Model Descriptors

Create fal-specific descriptors separate from app model IDs, for example:

- `convex/lib/models/fal/openai.ts`
- `convex/lib/models/fal/google.ts`
- `convex/lib/models/fal/xai.ts`
- `convex/lib/models/fal/black-forest-labs.ts`
- or per-model files if schemas diverge heavily.

Each descriptor should include:

- `appModelId`: existing SilkChat model ID.
- `falEndpoint`: text-to-image endpoint ID.
- `falEditEndpoint`: optional edit/reference endpoint ID.
- supported aspect ratios.
- supported resolutions.
- max images per request.
- reference-image support details.
- accepted safety fields.
- accepted quality fields.
- request input mapper.
- output parser/classifier.

Keep `MODELS_SHARED` as the public UI/backend app model metadata source. fal endpoint IDs should live only in descriptors/runtime job records.

### Queue And Webhook Flow

Prefer fal async queue/webhook over blocking `subscribe()`.

Submit with:

```ts
await fal.queue.submit(endpoint, {
  input,
  webhookUrl
})
```

The submit action should return quickly after creating server-side job state.

Add a table for generation jobs with fields along these lines:

- `userId`
- `appModelId`
- `falEndpoint`
- `falRequestId`
- `falGatewayRequestId?`
- `prompt`
- `aspectRatio`
- `resolution?`
- `referenceImageKeys`
- `status`
- `creditEventKey`
- `createdAt`
- `completedAt?`
- `error?`

Add a Convex HTTP webhook route, likely `/webhooks/fal`.

Webhook handler responsibilities:

- Authenticate/verify the webhook as much as fal supports.
- Find the job by `request_id`.
- Be idempotent. Duplicate webhooks must not double-store images or double-commit/release credits.
- Parse the result through the model descriptor.
- Download returned image URLs.
- Store generated assets under `generations/`.
- Insert generated image rows with `modelId: appModelId` and `referenceImageKeys`.
- Mark the job complete, partial, rejected, or failed.
- Finalize credits based on semantic outcome, not webhook HTTP success.

### Credit Outcomes

Reserve credits on job submit.

Only commit after at least one usable generated image is stored.

Release/refund for known non-image outcomes, including:

- fal/model safety filter response.
- provider refusal.
- invalid input rejection.
- no usable image payload.
- provider/runtime error.

Do not blindly treat `status: OK` as billable. Some successful webhook payloads may contain an error/refusal message rather than generated images.

Descriptor parser should classify output as something like:

```ts
{ kind: "images", images }
{ kind: "refusal", reason }
{ kind: "error", reason }
{ kind: "unknown", reason }
```

For partial results, decide policy explicitly. Recommended first pass: store available images, mark job partial, and bill only if the credit system can represent the actual stored image count. Otherwise document first-pass behavior.

## Reference Image Uploads

Current sidebar uploads reference images to `/upload` every time Generate is clicked, and `/upload` stores under `attachments/{userId}/...`.

New behavior should use a reference-specific upload path:

```txt
POST /upload/reference
```

Reference endpoint behavior:

- image-only.
- stores under `references/{userId}/...`.
- returns `{ key }`.
- no backend hash lookup or DB/R2 scan.
- writes through `r2.store`, so the object is recorded through the R2 component/table.

Client behavior:

- Each current reference item tracks `{ file, preview, hash, storageKey? }`.
- Compute SHA-256 only for files currently in the sidebar reference area.
- On Generate:
  - if item has `storageKey`, reuse it.
  - if another current item with the same hash already uploaded, reuse that key.
  - otherwise call `/upload/reference` once for that item.
- Repeated Generate clicks with unchanged current references must not reupload.
- Do not scan previous sessions/history for duplicate hashes.

Generated image rows should include:

```ts
referenceImageKeys?: string[]
```

Optionally include `generationJobId` or `falRequestId` for provenance/debugging.

## UI Implications

The library UI is already mostly model metadata-driven. Preserve these fields on image models:

- `mode: "image"`
- `maxPerMessage`
- `supportsReferenceImages`
- `supportedImageSizes`
- `supportedImageResolutions`
- `defaultImageQuality` or replacement metadata
- `legacy`, `sunsetOn`, `replacementId`
- plan-access fields

Webhook mode means local-only pending placeholders are insufficient. Add server-backed job state so pending generations survive refresh/navigation.

The existing sidebar runs one action per variant. If fal descriptors use `num_images`, update pending placeholders and credit accounting to match batched jobs.

## Cleanup/Removal

Remove legacy fal AI SDK wiring:

- dependency: `@ai-sdk/fal`
- import/use of `createFal`
- `case "fal"` in `convex/lib/provider_factory.ts` unless a non-image use remains.
- related provider factory tests/mocks.

Do not remove the `fal` string from shared provider types until confirming no settings/registry migrations depend on it.

## Testing Checklist

Follow `docs/TEST_WRITING_GUIDE.md`.

Recommended tests:

- fal descriptor maps app controls to correct endpoint input.
- `enable_safety_checker: false` is included where supported.
- `safety_tolerance: "1"` is included where supported.
- app model ID and fal endpoint ID stay distinct.
- generated image rows store app `modelId`, not fal endpoint.
- generated image rows store `referenceImageKeys`.
- current-selection reference dedupe prevents repeated uploads on repeated Generate clicks.
- `/upload/reference` only accepts supported image types and writes under `references/`.
- webhook handler is idempotent for duplicate `request_id`.
- webhook success with image commits credit after R2 storage.
- webhook safety/refusal payload releases credit.
- webhook provider error releases credit.
- partial image storage behavior is covered once policy is chosen.

## Open Questions

- Exact fal webhook verification mechanism to implement.
- Whether to expose fal job status in the existing library route query or a new query.
- Whether generated images should store `generationJobId`, `falRequestId`, or both.
- How to handle stuck jobs if webhook delivery fails. At minimum, keep enough data to poll `fal.queue.status/result` manually or via a later recovery action.
- Whether references should ever be garbage-collected. First pass should keep them for provenance as long as generated images reference them.
