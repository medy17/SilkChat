# Surfaces

Every surface in the app answers to one of two guides. Spotlight decides how generated content is
built: card, header, chips, expand frame. Glass is the material for anything that floats. They do
not compete: a Spotlight card is solid, and the controls floating on it are glass.

Start here for any new or restyled surface. Answer the questions in order and stop at the first
yes.

## Decide

1. **Did the model generate it?** Charts, tool cards, recipes, tables, image generation, roleplay
   markup, apps. Build it with [Spotlight](./SPOTLIGHT_SURFACES.md). Anything floating over it
   (tooltips, zoom controls, image arrows) uses `spotlight-glass`, which is the glass material.
2. **Is it a dialog, alert dialog, drawer, or sheet?** Use the primitive. The panel is solid and
   sits on the glass scrim. Do not restyle the scrim per dialog.
3. **Does it float above the page?** Menus, popovers, the composer, header controls, message hover
   actions, toolbars, controls over media, sticky bars. Use [Glass](./GLASS_SURFACES.md) and pick
   the tier from its table. Menus and popovers get glass from the primitives automatically.
4. **Does it cover something to show a state?** Loading, uploading, private viewing, drop targets.
   It is a veil: keep it local to the component and outside both systems.
5. **Otherwise it is content.** Messages, sidebar rows, settings, library tiles, cards. Solid, with
   theme tokens. No blur.

## Shared rules

- Colors come from theme tokens and must hold up in the default theme (light and dark) and one
  imported theme.
- Radii come from the theme scale (`--radius-sm` to `--radius-xl`).
- Never hand-roll `bg-*/NN backdrop-blur-*`. If a surface needs translucency, it is glass and uses
  a recipe; if no recipe fits, add a tier to `glass.css` and the Glass guide rather than a
  one-off.
- Glass honors the per-device setting and system preferences on its own. Components never check
  them.

## Guides

- [Spotlight Surfaces](./SPOTLIGHT_SURFACES.md): generated content.
- [Glass Surfaces](./GLASS_SURFACES.md): the floating material, its tiers, and its settings.
