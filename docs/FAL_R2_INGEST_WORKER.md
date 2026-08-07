# fal to R2 ingestion Worker

The optional Worker keeps generated image bytes out of Convex. Convex sends a signed request
containing the fal URLs and deterministic R2 keys; the Worker streams each URL into the bound bucket
and returns `204 No Content`. Convex then records the existing image metadata and finishes the job.

If the Worker is disabled or the request fails, the webhook uses the existing Convex
download-and-upload path. There are no Queues, callbacks, or Worker-owned job state.

## Configure an environment

The Wrangler config contains cloud development, staging, and production environments. Verify each
`bucket_name` in `workers/fal-r2-ingest/wrangler.jsonc` before deploying.

Authenticate Wrangler and set a different shared secret in each environment:

```powershell
bunx wrangler login

bunx wrangler secret put FAL_R2_INGEST_SECRET --config workers/fal-r2-ingest/wrangler.jsonc --env=""
bunx wrangler secret put FAL_R2_INGEST_SECRET --config workers/fal-r2-ingest/wrangler.jsonc --env staging
bunx wrangler secret put FAL_R2_INGEST_SECRET --config workers/fal-r2-ingest/wrangler.jsonc --env production
```

Deploy the selected Worker:

```powershell
bun run fal:r2:worker:deploy:cloud-dev
bun run fal:r2:worker:deploy:staging
bun run fal:r2:worker:deploy:production
```

Append `/ingest` to the deployed Worker URL and set the matching Convex environment:

```dotenv
FAL_R2_INGEST_URL="https://<worker-host>/ingest"
FAL_R2_INGEST_SECRET="<same-environment-secret>"
```

Push the environment and Convex backend using the repository's normal environment and deployment
commands. Removing `FAL_R2_INGEST_URL` immediately restores the Convex-only path.

## Validate

```powershell
bun run fal:r2:worker:typecheck
bun run check-types
bun run test
```

After enabling it, generate an image and confirm the Worker handles one `/ingest` request, the image
appears normally, and Convex logs do not contain the fallback message.

The Worker accepts HTTPS sources under `*.fal.media`, follows at most three validated redirects,
limits each streamed asset to 100 MiB, and gives the upstream request two minutes.
