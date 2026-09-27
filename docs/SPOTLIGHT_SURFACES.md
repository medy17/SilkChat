# Spotlight Surfaces

Spotlight is the shared visual language for anything the model produces inside a message:
native charts and networks, recipes, tables, image generation, tool approvals, tool run panels,
and roleplay markup. One card, one header, one set of controls, so generated artifacts read as a
family regardless of which tool made them.

## Owners

| Piece | Owner |
| --- | --- |
| `spotlight-surface`, `spotlight-glass` utilities | `src/styles/globals.css` |
| `SPOTLIGHT_CARD_CLASS`, `SpotlightHeader`, `SpotlightChips`, `useSpotlightFilter`, `SpotlightFrame` | `src/components/renderers/spotlight-frame.tsx` |
| Chart plotting, formatting, fill gradients, ticks | `src/components/renderers/chart-plot.tsx` |
| Chart data table | `src/components/renderers/chart-data-table.tsx` |
| Roleplay dialogue surface | `src/styles/roleplay.css` |

Read the owner for current values. This guide records the rules, not the class strings.

## The pieces

**Card.** `SPOTLIGHT_CARD_CLASS`: the theme's `--radius-lg`, a hairline border, a small shadow, and
`spotlight-surface`, an accent wash from `--chart-1` that fades into `--card` over a fixed length,
so tall cards (recipes, long tables) tint their header rather than their whole body. Every
artifact card and expanded tool panel uses it. Do not hand-roll a card border and background.

**Frame.** `SpotlightFrame` is the card plus header, an `actions` slot, a `toolbar` slot, and the
expand dialog. Native visualizations (chart, network) use it. State that the user sets, such as
hidden series or the Chart/Table view, lives in the renderer and is shared by the inline and
expanded views. The expanded body receives its measured size.

**Header.** Only the title shares a row with the controls, so adding controls never narrows the
description. Controls sit in negative margins so they do not push the description down.

**Chips.** `SpotlightChips` with `useSpotlightFilter`: click hides a series or group, hover and
focus spotlight it. At least one item always stays visible, and hiding the focused item releases
focus. Chips double as the legend, so they are omitted for a single series or when a chart sets
`showLegend: false`.

**Glass.** `spotlight-glass` is the frosted overlay for tooltips and controls floating over
content: chart tooltips, Mermaid zoom controls, and image generation pills and arrows.

**Loading.** A single row: a spinning `Loader2` in `text-primary` and a muted label. When the
card must reserve space, the row sits inside a Spotlight card.

## Rules

- Radii come from the theme scale. SVG marks that need a pixel radius, such as bar corners, use
  `useThemeRadiusPx`, which follows theme changes.
- Derive surfaces from theme tokens that guarantee contrast. Do not assume `--secondary` is
  raised: the default dark theme sets it below `--background`. Surfaces set in prose, such as
  roleplay dialogue bubbles, mix a step of `--foreground` into `--background` instead.
- The accent wash belongs to cards. Keep it off prose-level surfaces and text.
- Do not nest a card inside a Spotlight card. Inner sections use dividers or muted fills.
- Printing overrides the wash; recipe print styles set a plain background.

## Charts

- Line and area shading fades to nothing at its baseline on both sides of zero, so signed series
  and sampled functions (tan x) shade symmetrically instead of being cut off at zero. See
  `getFillGradientStops`.
- Numeric x axes use round-number ticks, falling back to Recharts when a domain is too extreme
  for float precision. See `getNiceTicks`.
- Axes and tooltips use `formatValue`: compact for large values, significant digits for small
  ones, so distinct values never collapse to `0`.
- The Chart/Table switch shows the exact rows behind the chart: no compact notation, no
  rounding, hidden series hidden as columns. The table takes the plot's footprint, so switching
  views never resizes the card.

## Streaming

Do not syntax-highlight model output on every token. Highlighting re-tokenizes the whole block
on the main thread, and a runaway line from a degenerate model can lock the tab.

- Code execution and Math Kit steps show code as plain text while the tool input streams and
  highlight once it is complete (`code-execution-group.tsx`).
- Code blocks in prose highlight finished lines only while the fence is open; the line being
  written stays plain (`splitStreamingCode` in `codeblock.tsx`).

## Adding a generated artifact

1. Wrap it in `SPOTLIGHT_CARD_CLASS`, or `SpotlightFrame` if it needs expand, filters, or view
   switching.
2. Use `SpotlightHeader` typography for the title and description.
3. Use `spotlight-glass` for anything floating over the content.
4. Design the loading, error, and empty states with the loading row and existing destructive
   styles.
5. Check the default theme in light and dark, plus one imported theme.

## Related guides

- [Abstractions & Conventions](./ABSTRACTIONS_&_CONVENTIONS.md)
- [Math Kit](./MATH_KIT.md)
- [Roleplay Markup](./ROLEPLAY_MARKUP.md)
- [Code Execution Architecture](./CODE_EXECUTION_ARCHITECTURE.md)
