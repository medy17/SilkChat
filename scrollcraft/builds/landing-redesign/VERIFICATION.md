# Verification

## Anchor and orchestration correction, 2026-09-13

- Typecheck and Biome pass. All 17 focused landing tests pass.
- New coverage verifies shared anchor inheritance for a complete section group, delayed brace opening after the handoff, and text/prop exclusion during transitions between rows of both equal and unequal heights. A React/Motion integration test checks the rendered opacity states during the prop crossfade.
- The preceding anchor/reveal iteration passed client/server compilation and prerendering of `/` using the existing cloud-development URL mapping. No environment files or secrets changed.
- The three supplied screenshots established actual cross-column collisions. The corrected choreography is verified by source and regression tests; no new browser or screenshot verification was performed, per repository instructions.

## Shared-stage handoffs, 2026-09-13

- TypeScript and Biome checks pass for the refactored components, shared stage, scroll hook, and tests.
- All 14 focused landing tests pass. New coverage checks complementary outgoing/incoming opacity at consecutive row boundaries, inactive-prop input exclusion, state preservation when revisiting a prop, and the narrow-screen inline fallback.
- JSX AST comparison against the pre-refactor source snapshot confirms that visible text, code tokens, and feature labels are unchanged in Providers, Workflows, Artifacts, Gallery, Testimonials, and Open source.
- Production client/server compilation and prerendering of `/` pass with the existing `CLOUD_DEV_CONVEX_*` URLs mapped to `VITE_CONVEX_*` for the build process. No environment files or secrets were changed. The initial unmapped run compiled but could not prerender because `VITE_CONVEX_URL` was absent.
- Shared-stage visuals consume their copy row's phase; their unused local scroll subscriptions are disabled. The code demo fits the stage without an inner vertical scrollbar. Pricing remains outside the stage.
- Browser visual review remains prohibited by repository instructions. Tests establish the handoff geometry and DOM behavior, not observed animation feel, visual spacing, or physical-device rendering.

## Code and testimonials restoration, 2026-09-13

- `bun run check-types`: passed.
- Existing landing scroll, hook, and sculpture geometry tests: 11 passed.
- Biome checks for the five affected source files: passed after formatting.
- JSX AST comparison against HEAD checks the original visible text, code tokens, and feature labels in both restored components. Testimonial data is unchanged.
- Source review confirms text-first mobile ordering, separate code/preview scroll measurements, full demo reveal on keyboard focus, compact opposing testimonial tracks with manual keyboard/reduced-motion access, and matching navbar anchors. No dev server or browser verification was run, per repository instructions. These checks do not establish the rendered animation feel.

Current revision: 2026-09-12. Local implementation; no deployment.

- TypeScript: `bun run check-types` passes.
- Tests: `bun run test` passes: 1,169 passed, 9 skipped, 0 failed. Tests cover scroll coordinate behavior and the stable reading interval/overscroll clamping of the new sculptures.
- Biome: changed/new UI and supporting source files checked.
- Production build: client/server compilation and prerendering of `/` pass with the existing cloud development URL variables mapped for the build process. No environment files or secrets changed.
- Geometry: local SVG parsing/extrusion confirms three separate conversation-symbol shapes and one brace shape. Extrusions are nonindexed, matching the winding correction after reflecting SVG coordinates into the scene.
- Original workflow and pricing components have no changes from HEAD. The redesign stylesheet contains no workflow overrides.
- Source review: section navigation IDs match; login actions retain router links; source and setup links target the actual repository; the existing gallery dialog remains connected. No screenshot or rejected cloth assets are referenced.
- Responsive and accessibility source review: narrow layouts stack; navigation wraps; artwork preserves natural aspect ratios; theme tokens supply colors and UI radii; focus reveals gallery images; reduced motion uses static geometry and disables new transforms; canvas failure retains SVG fallback.

## Unverified

No browser was launched and no dev server was started, as required by AGENTS.md. Desktop/mobile composition, intermediate scroll states, keyboard interactions, WebGL appearance, composited contrast, and subjective motion quality still need review in the existing local app. Compilation and tests do not prove those properties.

Earlier verification records described rejected versions. BRIEF.md records that history and the current composition.

## Follow-up verification

Device-height/silk/gallery/initial-pose fixes: TypeScript and Biome pass; all six focused landing-scroll tests pass, including full-device hero progress across phone/tall desktop sizes and different header heights. Browser verification remains prohibited, so the absence of visible pop-in and the gallery's perceived motion strength are not claimed as visually verified. The full-suite result above belongs to the preceding revision.

The final follow-up production build also passed client/server compilation and prerendered / successfully with the existing cloud-development URL mapping. No deployment or dev-server startup was performed.

## Animation startup regression

The previous follow-up incorrectly moved the shared scroll subscription into a child layout effect. At that point the parent scroll-container ref was still null, so setup returned and never subscribed. Restored passive-effect setup after the whole tree commits. The sculpture's separate pre-draw pose initialization remains intact.

A real React/Motion hook regression test mounts the section inside its parent scroll container in normal and StrictMode trees. Both cases fail with the previous layout-effect setup and pass with the fix, checking initial progress plus scrolling in both directions. All eight landing hook/geometry tests pass with no unhandled errors; typecheck, Biome, and diff checks pass. No browser or dev server was used.

Model diagram timing: all nine focused hook/geometry tests pass, including later visual-relative assembly across desktop/mobile dimensions. Typecheck, Biome, and diff checks pass. Browser observation remains unavailable under repository instructions.

## Gallery composition rework verification

Typecheck, Biome, and diff checks pass. The four source artworks were inspected locally. Source review confirms the original image-detail dialog and image metadata remain connected, image dimensions reserve natural proportions, named grid areas establish the desktop composition, and mobile returns to heading-first single-column flow. Focus/reduced-motion paths bypass the reveal. Browser visual review remains prohibited; these checks do not establish final visual quality.

Gallery rework production build passed client/server compilation and prerendered / successfully. No deployment was performed.

OSS timing now follows the braces' own bounds on desktop/mobile. Opening completes at screen center, holds for 8vh, then enters its gentle exit. The hero timeline is unchanged. Ten focused tests, typecheck, Biome, and diff checks pass; visual browser review remains unavailable.

## Hero dot clearance

The dot was a separate SVG shape receiving the rear bubble's translation, while its surrounding front outline moved the other way. The front outline and dot are now extruded into one mesh; the rear bubble remains independently animated. The original SVG path and settled logo shape are unchanged. A regression test raycasts the actual extruded geometry at the dot, its right-side gap, and the outline across assembly poses. It fails with the old three-part motion and passes with the grouped geometry. All eleven focused tests, typecheck, and diff checks pass.

## Centered compositions — observed browser correction, 2026-09-13

This revision supersedes the earlier copy-row/sticky-prop approach and the earlier browser-verification restrictions: Ahmed explicitly requested computer use for this review.

Observed the running localhost:3000 page in Edge before editing. At the initial tall viewport, props stayed high while copy scrolled past; navigation could land on an almost textless handoff. The independent text and prop positions were the underlying problem.

Text and prop now render inside one centered, full-viewport sticky composition. Every scene has 125svh of scroll travel, with a fully visible pair for approximately one viewport of that travel. The short outgoing/incoming envelopes do not overlap; changing prop sides cannot paint the incoming prop behind outgoing copy. The original copy, hierarchy, per-section sides, navbar, hero animation, and hidden scrollbar remain. The final composition holds while the shared stage releases into the existing pricing section.

Browser verification:
- Observed the Models composition stay centered across a substantial wheel scroll; DOM measurement confirmed copy and prop share a vertical center at 657.5px in a 1315px viewport.
- Inspected code-to-gallery and gallery-to-testimonial transitions, with only the current composition visible.
- Clicked Increment and observed the counter change from 0 to 1; its state survived navigation and resizing.
- Inspected testimonials and the subsequent braces entry/open pose, then the natural release into pricing.
- Verified the full code demo and adjacent copy fit at 1230x710, matching the shorter proportions of the reported screenshots. Restored the browser's normal size afterward.
- Ahmed observed the revision and reported: “Looks better now”.

Validation: TypeScript, Biome, all 17 focused landing tests, production client/server build, and prerender of / pass. Existing cloud-dev URL variables were mapped only for the build process; no environment files changed. No dev server was started and no deployment was performed. Mobile inline fallback is covered by the focused component test; physical mobile and OS reduced-motion appearance were not visually reviewed in this pass.
