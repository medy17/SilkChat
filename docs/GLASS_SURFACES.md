# Glass Surfaces

Start at [Surfaces](./SURFACES.md) to decide whether a surface is glass at all.

Glass is the material for everything that floats above the page: chrome, menus, popovers, and
overlays on generated content.
Content and modal panels are solid. This rule decides every case; do not add glass to a surface
because it "feels" premium, and do not make a floating surface solid because it is small.

The material is deliberately visible: low fill opacity, strong blur and saturation, a lit top rim,
and a sheen. A recipe that reads as solid over a flat background has been tuned too timidly.

## Owners

| Piece | Owner |
| --- | --- |
| Recipes and tokens (`glass-*`, `spotlight-glass`, `--glass-*`) | `src/styles/glass.css` |
| `bg-glass-control`, `bg-glass-control-hover` colors | `@theme` in `src/styles/globals.css` |
| Menu and popover material | `src/components/ui/{popover,dropdown-menu,context-menu,select,hover-card}.tsx` |
| Modal scrim | Overlays in `src/components/ui/{dialog,alert-dialog,drawer,sheet}.tsx` |
| Per-device setting and boot script | `src/lib/glass-settings-store.ts` |
| Look & Feel controls | `src/components/settings/glass-settings.tsx` |

Read the owner for current values. This guide records the rules, not the class strings.

## Tiers

| Tier | Surfaces | Treatment |
| --- | --- | --- |
| Chrome | Composer, header clusters, message hover actions, scroll-to-bottom, suggested replies, quote button | `glass-composer` or `glass-surface` |
| Raised chrome | Selection toolbars, comparison toolbar, controls and labels over images in viewers | `glass-raised` |
| Sticky bars | Edge-to-edge headers or footers that a page scrolls under | `glass-header` |
| Composer fade | The frost behind the composer that messages scroll under | `glass-fade` |
| Transient | Menus, popovers, selects, hover cards, model and persona pickers | `glass-popover` (from the primitives) |
| Generated content overlays | Chart tooltips, zoom controls, image generation arrows and pills | `spotlight-glass` |
| Modal | Dialogs, alert dialogs, drawers, sheets | Solid panel on `glass-scrim` |
| Content | Messages, sidebar rows, cards, settings, library grid, generated artifacts | Solid |

Transient surfaces get a denser fill and blur than chrome because they hold text. Tooltips stay
solid; they are too small to read as material. On mobile, responsive popovers become drawers and
follow the modal tier. Modal panels stay solid because the scrim already blurs everything behind
them; a translucent panel would only show the blurred scrim.

## Settings and preferences

Glass reads two per-device settings from the root element, set before first paint by the boot
script and kept in sync by `ThemeProvider`:

- `data-glass="off"` renders every recipe solid and removes every backdrop filter, including the
  scrim and composer fade. This is the performance and accessibility escape hatch.
- `--glass-intensity` scales every role's transparency together, in fixed steps. Each role has a
  floor, so the most transparent step never drops menus below legible.

The system preferences apply on top of the setting: `prefers-reduced-transparency` behaves like
off, and `prefers-contrast: more` lifts every floor and strengthens the edge.

When adding a tier, give it a base opacity, a floor, and an entry in the off and
reduced-transparency rules in `glass.css`. Check the most transparent step over a bright image and
a code block.

## Rules

- Use a recipe; never hand-roll `bg-*/80 backdrop-blur-*` on chrome.
- Recipes set background, edge, highlight, and shadow. Add `border` for the edge to render. Do not
  add `shadow-*` or `bg-*` utilities; they override the recipe.
- A `Button` carrying a recipe uses `variant="ghost"`. Other variants set a background that wins
  over the recipe. Hover states (`hover:bg-accent`, `hover:bg-background`) are fine.
- Controls inside a glass surface use `bg-glass-control hover:bg-glass-control-hover`. They never
  add a backdrop filter; the parent already blurs.
- Inside a glass popover, panels and sticky headers use no background (or `bg-transparent`), not
  `bg-popover`, which paints a solid block over the glass.
- Recipes tint from `--background` (`--popover` for `glass-popover`). Add `glass-sidebar` when the
  chrome floats over the sidebar.
- A page that needs desktop toolbar controls portals them into the header bar's slot
  (`useHeaderToolbarSlotStore`) instead of adding a second bar. The bar is a size container
  (`@container/app-header-bar`), so labels drop by its width rather than the viewport. See the
  library page.
- Overlays that should not dim or blur, such as a drawer stacked inside a viewer, pass
  `bg-transparent backdrop-filter-none`. Media viewers that need a dark stage override the scrim
  background only.
- Veils are not glass. Loading, upload, private-viewing, and drop-target overlays blur the thing
  they cover on purpose and keep their own classes.
- Radii come from the theme scale, as everywhere else.
- The setting, system preferences, and browsers without `backdrop-filter` are all handled in
  `glass.css`. Components never check them.
- The landing page and other marketing surfaces have their own language and are out of scope.
