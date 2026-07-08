# Dev Tools Guide

This guide documents the dev-only tooling in this repo: the floating Dev Utility Dock,
its overrides and diagnostics, the contextual dev controls that live inside real
workflows, and the backend Credit State Lab. Everything here is hard-gated so it never
ships to production.

## Core Concepts

### Availability gating

There are two independent gates — one on the frontend, one on the backend.

- **Frontend:** `canUseDevTools()` in `src/lib/dev-tools.ts` returns `import.meta.env.DEV`.
  Every dev component, store consumer, and side-effect folds this in, so nothing renders or
  runs in a production build.
- **Backend:** `process.env.DEV_CREDIT_LAB_ENABLED === "1"` gates the mutating dev
  endpoints (Credit State Lab, context-limit override). Convex `NODE_ENV` is always
  `"production"`, so this flag is the real signal. Set it on dev/staging deployments, never
  on prod.

The dev API routes under `src/routes/api/dev/*` additionally check
`process.env.NODE_ENV === "development"` and return `404` outside development.

### User mode vs Dev mode

The dock has a `mode` of `"user"` or `"dev"` (persisted in the `dev-tools-store`).

- **User mode:** the app behaves exactly like production. Only the small floating dock is
  visible; no overrides apply and no contextual dev controls appear.
- **Dev mode:** overrides take effect and contextual dev affordances appear in their
  workflows.

`useAreDevOverridesActive()` (`src/lib/dev-overrides.ts`) is `canUseDevTools() && mode === "dev"`;
`useShowContextualDevTools()` (`src/lib/dev-tools.ts`) additionally requires the
`showContextualDevTools` toggle.

### The two frontend stores

Persisted state is split so common reads stay cheap:

- `dev-tools-store` (`src/lib/dev-tools.ts`): `mode`, `showUtilityDock`,
  `showContextualDevTools`, `dockCorner`. Read app-wide.
- `dev-overrides-store` (`src/lib/dev-overrides.ts`): the actual override switches
  (animations, raw markdown, theme audit, image lab caps, context limits). Only override
  consumers subscribe.

Two non-persisted stores back live features: `useReproRecorderStore`
(`src/lib/dev-repro-recorder.ts`) and `useThreadDiagnosticsStore`
(`src/lib/dev-thread-diagnostics.ts`).

## The Dev Utility Dock

`src/components/dev/dev-utility-dock.tsx` — a floating trigger button pinned to a viewport
corner, mounted globally from `src/providers.tsx` alongside `DevRuntime`.

### Corner-snap drag

The dock rests against one of four corners (`dockCorner`). Dragging writes straight to the
element's CSS `translate` (GPU-composited, no layout, no per-frame store writes). On release
it projects the flick with an iOS-style momentum decay, picks the nearest corner by
distance, and springs to it using a `linear()` spring easing, then commits the new corner
once. Drag is disabled while the popover is open so the trigger and panel never desync. The
button icon is `public/dev_logo.png` in dev mode and the app `LogoSymbol` in user mode.

### Popover sections

- **Tools:** the User/Dev mode switch, the contextual-controls toggle, and the override
  switches (disable animations, raw markdown, theme audit) plus the on-the-fly context-limit
  fields.
- **Cache:** scoped `localStorage` clears (see below) and, when the local image optimizer is
  enabled, a purge button for its image cache.
- **Info:** a copyable diagnostics snapshot (route, user, model, plan, access, optimizer,
  context override) and, when a thread is active, the read-only Thread diagnostics.
- **Repro:** the repro recorder toggle plus export/clear.

## Dev Runtime

`src/components/dev/dev-runtime.tsx` — renders nothing; owns the global side-effects that
must run whether or not the popover is open:

- Sets/removes the `data-dev-no-animations` root marker for the disable-animations override.
- Runs the live theme audit loop on an interval while the override is on.
- Installs the repro recorder's window error/rejection listeners and pushes route changes to
  the timeline.

## Overrides

Defined in `src/lib/dev-overrides.ts`. Each override only applies while overrides are active
(dev mode). Consumers use the `useDev*` hooks, which already fold in `useAreDevOverridesActive()`.

| Override | Hook / helper | Effect |
| --- | --- | --- |
| Disable animations | `useDevDisableAnimations` | `DevRuntime` sets `data-dev-no-animations`; `globals.css` zeroes all animation/transition durations under it. |
| Raw markdown | `useDevRawMarkdown` | `memoized-markdown.tsx` shows message source instead of rendering. |
| Theme audit | `useDevThemeAudit` | Live scan tags hardcoded radius/color offenders with `.dev-theme-violation`. |
| Context limits (OTF) | `getActiveDevContextOverride` | Injected into the chat request; see Context-limit override below. |

Numeric caps are resolved with the pure helpers `resolveDevCapOverride` and
`resolveDevReferenceLimit` so cap-resolution logic stays testable. The image-lab override
fields (`imageVariantMax`, `imageReferenceMax`, `imageRunTotalMax`, `aspectRatioOverride`,
`disableImageCompression`) exist in the store but are wired into workflows incrementally.

## Contextual dev controls

Workflow-specific controls live next to the workflow they affect, gated by
`useShowContextualDevTools()`. Current call sites:

- `src/components/header.tsx`
- `src/components/threads-sidebar.tsx`
- `src/components/library/image-generation-sidebar.tsx`
- `src/routes/settings/profile.tsx`

The dock owns global utilities and diagnostics; it does not replace these contextual controls.

## Cache clearing

`src/lib/dev-tools.ts` defines `DevStorageScope` and the pure helpers
`getDevStorageKeysForScope` / `clearDevStorageScope`. Scopes:

- `convex` — `CVX_DISK_CACHE:*`
- `model` — `model-storage`
- `theme` — `theme-store`
- `credits` — `prototype-credit-*`
- `library` — library generation/viewing state and image-migration markers
- `all-app-state` — the union of the above (never touches auth tokens or unrelated keys)

## Diagnostics

The Info section shows a general snapshot plus, when a thread is open, a read-only Thread
subsection published from the chat view.

`src/lib/dev-thread-diagnostics.ts` owns this: `usePublishThreadDiagnostics` is called from
the thread view (it has the live messages, resolved persona, and context model), computes
stats via the pure `computeThreadStats`, and writes them to `useThreadDiagnosticsStore` for
the dock to render. It clears on unmount so stats never linger after leaving a thread. Thread
diagnostics cover persona info, attachment-type counts, message counts, canonical
(OpenRouter) vs estimator token splits, thread cost, and tokens-until-hosted-limit with an
OTF indicator.

> Known gap: only wired into the main chat view (`chat.tsx`). Project/folder threads
> (`folder-chat.tsx`) don't publish diagnostics yet.

## Repro recorder

`src/lib/dev-repro-recorder.ts` keeps a capped (`REPRO_EVENT_LIMIT = 100`), non-persisted
rolling log of route changes, runtime errors, unhandled rejections, and manual marks — only
while recording. `serializeReproBundle` renders the timeline plus a diagnostics snapshot as a
pasteable markdown bundle (the "Export" action). It's a live recorder, not history.

## Credit State Lab

A dev-only way to put the current user into specific plan/usage/access states.

### Route

`src/routes/api/dev/credit-state.ts` — returns `404` outside development, `401` without an
authenticated user, and `400` on invalid payloads.

- `GET` returns the current user's dev credit state via `api.credits.getMyDevCreditState`.
- `POST` validates the body and applies it via `api.credits.setMyDevCreditState`.

`src/routes/api/dev/credit-plan.ts` remains as a compatibility wrapper for the older
plan-only concept.

### Backend

`convex/credits.ts` implements `getMyDevCreditState` / `setMyDevCreditState`, both gated by
`DEV_CREDIT_LAB_ENABLED === "1"` and scoped to the current user only. Settable fields:

- `plan: "free" | "pro"`
- `monthlyBasicCredits`, `monthlyProCredits`
- `isStaff` and `bypassLimits` (independent — `isStaff` is access metadata; `bypassLimits`
  is the actual enforcement bypass; turning on `isStaff` must not enable `bypassLimits`)
- `usageScenario` — a deterministic preset that resets current-period test state and inserts
  dev-labeled synthetic events (`dev-credit-lab:` message-key prefix). Presets:
  `normal_empty`, `basic_remaining_zero`, `basic_near_limit`, `pro_remaining_zero`,
  `pro_near_limit`, `byok_heavy`, `internal_heavy`, `staff_with_limits`,
  `staff_with_bypass_limits`
- `periodAnchorPreset` — `default`, `ending_today`, `ending_tomorrow` (adjusts
  `creditPeriodAnchorAt`; an active pro renewal may control the period instead)

The contextual Credit State Lab UI lives in the credits/account surface
(`src/components/credits/prototype-credits.tsx`).

## Context-limit override (OTF)

An on-the-fly way to shrink the hosted/model context limits for your next send.

1. The Tools section writes `hostedContextLimitOverride` / `modelContextLimitOverride` to the
   overrides store.
2. `getActiveDevContextOverride()` reads them non-reactively at send time and the chat
   integration injects them into the request body as `devContextOverride`.
3. `convex/chat_http/post.route.ts` honors `body.devContextOverride` **only** when
   `DEV_CREDIT_LAB_ENABLED === "1"`; `convex/lib/context_limits.ts` folds the override into
   `resolveContextLimits`.

It applies to whichever model your next send uses. A future refinement is a true per-model
override map keyed by model id instead of the single global pair.

## Files

- `src/lib/dev-tools.ts`: dev-tools store, mode/dock/corner state, storage-scope helpers
- `src/lib/dev-overrides.ts`: override store, active-mode hooks, cap-resolution helpers,
  context-override reader
- `src/lib/dev-repro-recorder.ts`: repro recorder store, listeners, bundle serializer
- `src/lib/dev-thread-diagnostics.ts`: thread stats/diagnostics store and publisher hook
- `src/lib/dev-theme-audit.ts`: pure theme-token violation detection and DOM audit
- `src/components/dev/dev-utility-dock.tsx`: the floating dock UI + corner-snap drag
- `src/components/dev/dev-runtime.tsx`: global dev side-effects
- `src/routes/api/dev/credit-state.ts`, `src/routes/api/dev/credit-plan.ts`: dev API routes
- `convex/credits.ts`, `convex/settings.ts`, `convex/chat_http/post.route.ts`,
  `convex/lib/context_limits.ts`: backend Credit State Lab and context-override honoring
- `src/styles/globals.css`: `data-dev-no-animations` and `.dev-theme-violation` styles

## Adding A New Dev Tool

1. **Global utility or diagnostic?** Add it to the dock (`dev-utility-dock.tsx`) in the
   appropriate section. **Tied to a specific workflow?** Render it inline in that component,
   gated by `useShowContextualDevTools()`.
2. **New override?** Add the field + setter + default to `dev-overrides-store` and expose a
   `useDev*` hook that folds in `useAreDevOverridesActive()`. Keep any resolution logic pure
   and unit-tested.
3. **Global side-effect** (root marker, interval, listener)? Put it in `DevRuntime`, guarded
   by `canUseDevTools()`.
4. **Backend mutation?** Guard it in both the API route (`NODE_ENV`) and the Convex function
   (`DEV_CREDIT_LAB_ENABLED`), and scope it to the current user.
5. Use theme variables for all new UI — no hardcoded radius/color values (the theme audit
   will flag them). Mark dev-owned overlays with `data-dev-audit-ignore` so the audit skips
   them.

## Testing

Tests live under `tests/lib/dev-*.spec.ts` and `tests/backend/*` and follow
`docs/TEST_WRITING_GUIDE.md`. Run with `bun run test`. Coverage includes:

- Storage-scope helpers remove only their intended keys.
- Override cap-resolution helpers.
- Repro bundle serialization and theme-audit detection.
- Credit-state route: `404` in production, `401` unauthenticated, rejects invalid payloads,
  applies plan/limits/`isStaff`/`bypassLimits`.
- Credit lab scenarios produce the expected remaining basic/pro credits, and `bypassLimits`
  bypasses enforcement while `isStaff` alone does not.

## Gating Rules (do not break)

- Anything under `src/lib/dev-*` or `src/components/dev/*` must be gated by
  `canUseDevTools()` before it renders or runs.
- Overrides must only apply in dev mode; user mode must match production.
- Mutating backend dev endpoints must check `DEV_CREDIT_LAB_ENABLED` and never be reachable
  in production. Set the flag on dev/staging only.
