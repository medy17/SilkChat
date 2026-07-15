# Testing Overview

This document describes the test suite and workflow. Test-writing standards live in [Test Writing Guide](./TEST_WRITING_GUIDE.md).

## Runner

Vitest is configured in `vitest.config.ts` and discovers `tests/**/*.spec.ts` in a Node environment. Shared setup lives in `tests/setup.ts`.

Run the complete one-shot suite with:

```bash
bun run test
```

Do not use `bun test`; it has different Bun semantics. For focused iteration, invoke Vitest through Bun:

```bash
bunx vitest run tests/backend/post-route.spec.ts
bunx vitest run tests/lib/credits.spec.ts
```

Local runs use `tests/reporters/pretty-reporter.ts`. CI uses Vitest’s default reporter.

## Test Layout

- `tests/backend/`: Convex functions, chat streaming, providers, billing, image generation, storage, and account lifecycle
- `tests/routes/`: TanStack Start and API route behavior
- `tests/components/`: components with meaningful rendering or interaction branches
- `tests/hooks/`: chat, voice, thread, and credit state coordination
- `tests/imports/`: import/export formats and compatibility
- `tests/lib/`: pure utilities, stores, formatting, metering, theme, dev tools, and browser helpers

Use the directory matching the behavior under test, even when the production file lives elsewhere.

## Current Coverage Areas

The suite covers the high-risk custom behavior in this repository, including:

- auth token resolution and auth-route proxy/recovery behavior
- model/provider selection, abilities, metadata, and OpenRouter attribution
- chat request validation, streaming transforms, resumption, stopping, prompts, and titles
- credit periods, reservations, metering, billing events, and dev-state scenarios
- account deletion, identity restoration, and LemonSqueezy webhook behavior
- fal descriptors, webhook verification, durable image jobs, image storage, and recovery
- attachments, file listing, image context, and R2 URL handling
- import/export parsing and job orchestration
- chat hooks, voice recording, model state, cached queries, and generation state
- focused component behavior and theme/dev-tool utilities

This is not a claim of exhaustive coverage. The checked-in test files and production behavior are the source of truth; avoid copying volatile test counts into docs.

## Browser E2E Status

There is no repository-owned Playwright/Cypress harness. Authenticated browser E2E requires a deterministic app startup, Convex deployment/data strategy, signed-in fixture, and policy for real versus mocked providers. Until those are defined, Vitest tests provide the reliable automated baseline.

## Change Workflow

1. Read [Test Writing Guide](./TEST_WRITING_GUIDE.md).
2. Run the smallest relevant file while iterating.
3. Run `bun run test` before completing the change.
4. Run `bun run check-types` for code changes.
5. Run Biome on changed code/test files and stage the rewritten files together.

Example formatting command:

```bash
bunx biome check --write tests/backend/post-route.spec.ts --files-ignore-unknown=true --no-errors-on-unmatched
```

Avoid partially staging a file that Biome will rewrite. `lint-staged` can fail to restore overlapping staged and unstaged edits even when the code itself is valid.

## Priorities for New Tests

Prefer coverage for business rules, user-visible state transitions, permissions, validation, recovery, idempotency, and external data contracts. Place feature tests near the relevant behavior.

Do not prioritize snapshot-heavy generic UI coverage or tests that only assert mock choreography. Extract pure decision logic when a route, hook, or component cannot be tested without replacing most of its collaborators.
