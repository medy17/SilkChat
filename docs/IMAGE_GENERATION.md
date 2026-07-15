# fal Image Generation

Image generation uses native `@fal-ai/client` queue submissions and verified webhooks.

## Runtime Flow

Both library generation and the chat image tool use fal-backed model descriptors and durable `imageGenerationJobs` state.

1. Validate the app model, controls, references, plan access, and deletion gate.
2. Reserve metered usage.
3. Create a job with the app model ID, resolved fal endpoint, request controls, provenance, and credit event key.
4. Submit with `fal.queue.submit()` and attach the returned fal request ID.
5. Receive `/webhooks/fal`, verify its Ed25519 signature against fal JWKS, and claim the job with a processing lease.
6. Parse the model-specific result, download usable assets, store them in R2, create generated-image rows, and finalize or release usage.
7. Publish durable job/image state so pending and completed generations survive navigation and refresh.

Duplicate webhooks and repeated terminal updates are idempotent. App-facing rows retain the SilkChat model ID; fal endpoint IDs remain runtime/job metadata.

## Model Descriptors

Descriptors live under `convex/lib/models/fal/`:

- `openai.ts`
- `google.ts`
- `xai.ts`
- `black_forest_labs.ts`
- `bytedance.ts`
- `shared.ts` and `types.ts`

Each model maps app controls to its actual fal endpoint schema. Do not assume that all endpoints accept the same `aspect_ratio`, `resolution`, `image_size`, safety, or reference-image fields.

The shared model registry in `convex/lib/models.ts` remains the public UI/backend metadata source. A model must have both accurate public abilities and a matching fal descriptor.

Current endpoint-specific behavior is encoded and tested in the descriptor modules rather than duplicated here. When fal changes a schema, update the descriptor and its focused tests together.

## Job State and Recovery

`convex/image_generation_jobs.ts` owns job lifecycle and user-visible recovery. States include submission, processing, completed/partial outcomes, failures/refunds, and `storing_failed` when fal succeeded but an asset could not be copied into R2.

For `storing_failed`, fal asset URLs are retained and the user can retry materialization. Retries are ownership-checked, serialized, rate-limited, and capped. There is no scheduled status poller for a submitted job whose webhook never arrives.

The processing lease lets a later delivery reclaim a job if a webhook worker dies mid-processing.

## Webhook Security

`convex/fal_webhooks.ts` verifies these headers using fal’s JWKS:

- `X-Fal-Webhook-Request-Id`
- `X-Fal-Webhook-User-Id`
- `X-Fal-Webhook-Timestamp`
- `X-Fal-Webhook-Signature`

Timestamps have a bounded replay window, and JWKS values are cached. Never bypass verification for production webhook traffic.

## Credit Outcomes

Usage is reserved before submission and reconciled according to semantic outcome:

- commit when at least one usable image is stored
- finalize a partial outcome when only some assets are usable
- release/refund on provider error, refusal, safety rejection, invalid/no-image output, or submission failure
- preserve recoverable state when fal returned an image but R2 materialization failed

An HTTP-successful webhook is not automatically a billable success. Descriptor parsers classify the payload first. Fal billing reconciliation is handled separately by `convex/fal_billing_node.ts`.

## Reference Images

Reference uploads use `POST /upload/reference` and store image-only objects under `references/{userId}/...`.

The sidebar computes SHA-256 hashes for references selected in the client session. It reuses an uploaded key on repeated generation and for duplicate selected items, but it does not scan R2 objects or database rows for matching hashes.

Generated image and job records retain `referenceImageKeys` for provenance. Reference support and count limits must come from model metadata/descriptors; models without a compatible edit endpoint must reject references.

## Important Files

- `convex/images_node.ts`: library submission action
- `convex/lib/tools/image_generation.ts`: chat image-generation tool
- `convex/lib/models/fal/`: endpoint descriptors and payload parsing
- `convex/image_generation_jobs.ts`: durable jobs, terminal state, and asset recovery
- `convex/fal_webhooks.ts`: signature verification and webhook processing
- `convex/fal_billing_node.ts`: settled-cost reconciliation
- `convex/images.ts`: generated-image queries and mutations
- `convex/schema/image_generation_job.ts`: job schema
- `convex/schema/generated_image.ts`: stored generated-image schema
- `src/components/library/image-generation-sidebar.tsx`: library controls and submission
- `src/components/library/generation-store.ts`: pending-generation client state

## Invariants

- Use `FAL_KEY`; do not reintroduce `@ai-sdk/fal` or `createFal`.
- Preserve app model IDs in `generatedImages.modelId`.
- Keep fal endpoint IDs inside descriptors and job/runtime data.
- Keep reference upload dedupe scoped to the current client selection.
- Only send safety or quality fields accepted by the selected descriptor.
- Keep webhook processing and credit reconciliation idempotent.
- Apply account-deletion gating to new generation entry points.

## Current Limitations

- Decide whether submitted/processing jobs need a scheduled fal status poller for permanently missed webhooks.
- Revisit reference garbage collection only with a provenance-safe retention policy.

## Testing

Relevant suites include:

- `tests/backend/fal-image-models.spec.ts`
- `tests/backend/fal-webhooks.spec.ts`
- `tests/backend/image-generation-jobs.spec.ts`
- `tests/backend/images-node.spec.ts`
- `tests/backend/image-generation-tool.spec.ts`
- `tests/backend/prepare-image-request.spec.ts`
- `tests/lib/library-generation-store.spec.ts`
- `tests/lib/pending-image-generation.spec.ts`

Follow [Test Writing Guide](./TEST_WRITING_GUIDE.md) and run `bun run test`.
