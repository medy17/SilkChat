# SilkChat Apps

Models write interactive apps (simulators, calculators, explorers, 3D scenes) as a
` ```silk-app ` fence: one TSX module that default-exports a component. SilkChat runs it
inline in a sandboxed frame, styled to the user's theme.

## Owners

| Piece | Owner |
| --- | --- |
| Prompt and kit reference | `convex/chat_http/skills/canvas.ts` |
| Message block: streaming, reveal, code view, expand | `src/components/silk-app/silk-app-block.tsx` |
| Sandboxed frame and host side of the protocol | `src/components/silk-app/silk-app-frame.tsx` |
| Message contract and validation | `src/lib/silk-app/protocol.ts` |
| Theme, fonts, and frame document | `src/lib/silk-app/host-theme.ts` |
| Frame runtime: transform, module registry, render | `src/silk-app-runtime/` |
| `@silk/ui` kit | `src/silk-app-runtime/kit/` |
| Frame Tailwind theme | `src/silk-app-runtime/frame.css` |
| Lazy chunks | `src/silk-app-runtime/chunks.ts` |
| Runtime build | `scripts/build-silk-app-runtime.mjs` |
| Vite wiring: dev rebuilds, runtime version | `scripts/silk-app-runtime-plugin.ts` |

## How it runs

1. `MemoizedMarkdown` lifts each top-level `silk-app` fence out of the Markdown
   (`splitSilkAppContent`) and renders a `SilkAppBlock`, keyed by its order among the
   message's apps. Streamdown remounts everything inside it when a reply finishes or
   stops, which would restart a running app. The block shows a loading card while the
   fence streams and mounts the frame once it closes and nears the viewport. A fence the
   reply stopped writing isn't run. Fences Streamdown still sees, such as one indented
   in a list item, reach `SilkAppBlock` through `Codeblock`.
2. The frame is a `srcdoc` iframe with `sandbox="allow-scripts allow-forms"`. Without
   `allow-same-origin` its origin is opaque: model code can't read cookies, storage, or
   the host page. Never add `allow-same-origin` to a frame that runs model code. The
   document's CSP keeps the app offline: scripts only from the runtime, no fetches, no
   form submissions, images and media only from `data:` and `blob:`. The runtime
   cancels link clicks, and the host removes a frame that loads a second document.
3. The frame loads `/silk-app/<version>/tailwind.js` (`@tailwindcss/browser`) and
   `/silk-app/<version>/runtime.js`, then posts `silk-app:ready`.
4. The host replies with `silk-app:render`: the code, the mode (inline or expanded), and
   a theme snapshot read from the host's computed CSS variables. Self-hosted fonts follow
   as bytes in `silk-app:fonts`, because an opaque origin can't fetch them.
5. The runtime transforms the code with sucrase, loads any lazy chunks it imports,
   evaluates it against the module registry, and renders it. After Tailwind's next pass
   it posts `silk-app:rendered` with the content height; the block fades the app in.
6. A ResizeObserver reports `silk-app:resize`; host theme changes post `silk-app:theme`.
   An open select or tooltip that can't fit below its trigger counts toward the height,
   since portals add nothing to the body. Past `SILK_APP_MAX_INLINE_HEIGHT` the frame
   stops growing and its content scrolls.

Both sides check the message source, not the origin, and validate every message:
the frame runs model code, so nothing it sends is trusted.

While it boots, the frame sits full-size and transparent over the loading card. Browsers
pause rendering, including `requestAnimationFrame` and ResizeObserver, in cross-origin
frames that are hidden or zero-size, and the sandboxed frame counts as cross-origin. A
collapsed boot frame never reports `rendered`. For the same reason the runtime uses
timers, not animation frames, before the app is revealed. jsdom doesn't throttle, so
headless tests won't catch a regression here. If a frame stays silent for 15 seconds,
the block shows an error instead of spinning.

## Modules

The registry in `src/silk-app-runtime/modules.ts` is the whole import surface: `react`,
`react-dom`, `recharts`, `motion/react`, `clsx`, `tailwind-merge`, and `@silk/ui`.
`@/components/ui/*` and `@/lib/utils` resolve to the kit, since models write shadcn
imports by habit. Stylesheet imports are ignored.

`lucide-react`, `three` (with `three/addons` OrbitControls), and `d3` are lazy chunks,
loaded only by apps that import them. Chunks use the runtime's React through
`__SILK_APP_SHARED__` rather than bundling a copy. `src/silk-app-runtime/chunks.ts`
lists them for both the registry and the build.

## The kit

`@silk/ui` re-exports SilkChat's own primitives unchanged, so apps match the host, and
adds app pieces: `AppHeader`, Spotlight `Card`, toned `Alert` and `Tag`, `Stat` with
animated numbers, `Chart` on the shared plot engine (right axis, fixed domains,
reference lines), `Control`, `Segmented`, a number-friendly `Slider`, a device-pixel
`Canvas`, and `useThemeColors` for canvas and WebGL. Follow
[Spotlight Surfaces](./SPOTLIGHT_SURFACES.md) when changing them. Anything added to the
kit also needs a line in the prompt reference in `canvas.ts`.

## Building

`public/silk-app/` is generated and gitignored. The dev server builds it into
`public/silk-app/dev/` on start and again when any source file of the runtime changes;
restart the app to pick up a rebuild. `prebuild` runs `bun run silk-app:build`, which
writes `public/silk-app/<content hash>/`. Those files are served `immutable`, and a tab
open across a deploy never pairs its host with a newer runtime: its apps fail to start
until the page reloads.

The frame's theme colors are listed once, in `SILK_APP_THEME_COLORS`. `frame.css` needs
a fallback and a Tailwind color for each; a test checks it.
