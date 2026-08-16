# Composer Intent Guide

The composer intent guide is the capability-discovery surface shown beneath the composer on
an empty, default-persona chat. It helps a user move from a broad intention to a useful prompt,
attachment, and tool configuration without turning the new-chat screen into a permanent tool
catalog.

The guide currently supports three intents:

- **Create an image**
- **Search the web**
- **Analyze files**

`src/lib/composer-intents.ts` owns the intent IDs, starter prefixes, static recipes, attachment
classification, and stage resolver. `src/components/intent-guide.tsx` renders the stages, while
`src/components/multimodal-input.tsx` owns the active intent and connects guide actions to the
real composer.

## Visibility and Capability Gating

The guide appears only when all of the following are true:

- the chat has no messages and has not created a thread yet;
- the default persona is selected;
- the selected model is not an image-only model;
- the composer is empty, or an intent is already active; and
- the individual intent is supported by the selected model and available tools.

Image requires vision and function calling. Web requires function calling and an available web
search tool. Analysis requires function calling and available code execution. Unsupported intents
are removed from the initial list rather than displayed as disabled actions.

The initial choices are deliberately a left-aligned vertical list. This keeps labels easy to scan
and avoids a horizontally clipped discovery surface on narrow screens.

## State Model

The guide derives its stage from the active intent, composer draft, and attachment count. The
prefix inserted by an intent is not considered a meaningful draft by itself.

| Intent | Condition | Stage | Guidance |
| --- | --- | --- | --- |
| None | Initial state | `idle` | Vertical intent list plus Attach a file |
| Image | No meaningful draft or attachment | `image-explore` | Upload a reference or choose a visual recipe |
| Image | Meaningful draft, no attachment | `image-reference` | Upload a photo or attach a recent generation |
| Image | One or more attachments | `image-refine` | Restyle, create variations, or recompose |
| Web | No meaningful draft | `web-explore` | Regional Google trends, or static search recipes on failure |
| Web | Meaningful draft | `web-compose` | Compact confirmation that web search is ready |
| Analysis | No attachments | `analysis-source` | Upload a spreadsheet, document, code file, or files to compare |
| Analysis | One or more attachments | `analysis-actions` | Actions selected for spreadsheet, document, code, image, or mixed input |

Selecting an intent inserts its starter prefix only when the composer is otherwise empty. Clearing
an intent removes that untouched prefix, but preserves text the user has added. Choosing a recipe
replaces the draft; refinement actions append to it.

## Action Cascades

### Create an image

The first stage combines an upload card with four static visual recipes. Recipe metadata lives in
`src/lib/composer-intents.ts`; the WebP thumbnails live under `public/intent-guide/`.

Once the user has written a meaningful prompt, the guide offers an uploaded reference or up to six
recent generated images. Recent images come from `api.images.paginateGeneratedImages`. Selecting
one downloads the original from the public R2 URL, converts it into a browser `File`, and sends it
through the normal attachment pipeline. It must not use the Convex HTTP storage proxy.

After an attachment is present, the guide offers prompt refinements for restyling, variations, and
recomposition.

### Search the web

Selecting Web automatically enables `web_search` when it is not already enabled and then loads
regional Google Trends suggestions. Four live trends are shown as prompt actions. Selecting one
creates a prompt asking for the latest reliable information, an explanation of why the topic is
trending, and primary-source citations.

If the live request fails or returns no usable items, the UI falls back to static recipes for a news
brief, product comparison, claim verification, and sourced research.

### Analyze files

Selecting Analysis automatically enables `code_execution` when needed. Before upload, the guide
offers source-type entry points. After upload, file extensions and MIME types classify the input as
spreadsheet, document, code, image, or mixed. Each class has three tailored prompt actions. Multiple
attachment classes resolve to `mixed` and receive comparison, synthesis, and inconsistency actions.

The standalone Attach a file action enters the Analysis cascade before opening the existing upload
flow.

## Google Trends Data Flow

The client calls the same-origin `GET /api/search-trends` route. The route fetches Google's public
daily-trends RSS feed and returns a small validated JSON shape containing the query, approximate
traffic when present, and publication time when parseable. This path is frontend/server-route owned;
it does not depend on Convex and stores no trend rows in the database.

Country resolution is:

1. `X-Vercel-IP-Country`, derived by Vercel from the incoming request in deployed environments;
2. the `fallbackGeo` query parameter supplied by the browser; then
3. `US`.

The browser fallback examines `navigator.languages` in order and uses
`Intl.Locale(language).maximize().region`. This means `en-GB` resolves to `GB`, while plain `en`
normally maximizes to `US`. Browser language is a preference, not a guarantee of physical location.

The app route keeps a per-country, warm-instance cache for 15 minutes and permits stale data for up
to one hour when refreshing Google fails. Responses also advertise a 15-minute shared-cache TTL,
one-hour stale-while-revalidate window, and `Vary: X-Vercel-IP-Country` so Vercel's CDN does not
mix deployed country variants.

In local development the Vercel geo header is absent, so browser locale is the normal signal. There
is intentionally no public-IP lookup service, local geo sidecar, or developer country override at
present.

## Layout and Mascot Behavior

The empty-chat hero remains centered instead of adopting a permanently bottom-pinned composer. The
guide therefore changes in place below the composer. It reserves the height of the initial vertical
intent list with an invisible layout element so switching into a cascade does not pull the composer
and mascot upward.

Image/reference cards use a horizontally scrollable snap row because their thumbnails need useful
visual area. Action lists use responsive grids that collapse to fewer columns on narrow screens.
Card dimensions shrink on short viewports. On very short screens the full mascot is replaced by a
face crop, and the mascot is hidden entirely below the smallest height breakpoint.

`src/components/chat-mascot.tsx` is a standalone, theme-token-driven SVG component. When the
composer is focused and contains text, its head, pupils, and thicker cocked eyebrow shift toward the
composer; the eyebrow occasionally glints. Ambient motion and the glint respect
`prefers-reduced-motion`.

## Accessibility and Theming

- All actions are native buttons with visible focus-ring styling and accessible labels where the
  icon alone does not communicate the action.
- Decorative imagery and icons are hidden from assistive technology where appropriate.
- Loading state is expressed with both an animation and the text “Finding what’s trending…”.
- The mascot has a title and description.
- Colors, borders, and radii use theme variables. New intent UI must not introduce hardcoded color
  or radius values.
- Motion is brief and positional continuity is preferred over resizing the hero between stages.

## Known Gaps and Deliberate Omissions

- **Memory discovery:** Memory is not an intent. It remains a turn-by-turn tool in the composer
  menu and has a dedicated Memory settings page for reviewing and managing saved memories.
- **Local geo fidelity:** local trends follow browser language, not network location. There is no
  deterministic development override or IP-geolocation helper. This is acceptable until regional
  testing becomes frequent enough to justify a dev-tool control.
- **Locale changes:** trends load once per mounted composer. Changing browser languages after the
  first load requires remounting or refreshing the page.
- **Trend depth:** only four RSS topics are surfaced, with no categories, trend explanations, or
  personalization before selection.
- **Upstream contract:** Google Trends RSS is public but not a versioned application API. Parser and
  fallback behavior must remain defensive if its XML shape or availability changes.
- **Recent-image scope:** the image cascade shows only the newest six active generated images and
  does not provide search, folders, or pagination in the guide.
- **Persona scope:** custom personas do not receive the intent guide; they retain their own empty-chat
  presentation.

## Important Files

- `src/lib/composer-intents.ts`: intent types, recipes, prefixes, attachment classification, and
  stage resolution
- `src/components/intent-guide.tsx`: all guide stages and action presentation
- `src/components/multimodal-input.tsx`: state, tool enabling, prompt mutations, uploads, and live
  data loading
- `src/components/chat.tsx`: empty-chat hero, visibility gate, and mascot activity state
- `src/components/chat-mascot.tsx`: themed animated mascot
- `src/lib/google-trends.ts`: browser locale resolution, response validation, and trend prompts
- `src/lib/google-trends-rss.ts`: server-side RSS parsing and country normalization
- `src/routes/api/search-trends.ts`: same-origin Google Trends endpoint and caching
- `public/intent-guide/`: image-recipe thumbnails

## Testing

Pure behavior is covered by:

- `tests/lib/composer-intents.spec.ts`
- `tests/lib/google-trends.spec.ts`
- `tests/backend/google-trends-rss.spec.ts`
- `tests/lib/generated-image-urls.spec.ts`

Follow [Test Writing Guide](./TEST_WRITING_GUIDE.md) and run the full suite with
`bun run test`.
