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

One exception to the first question: a selected row that opens to hold its own settings may borrow
the Spotlight card (`SPOTLIGHT_CARD_CLASS`), as the selected models in the image sidebar do. It
takes the card alone, with no header, chips, or frame, and only where the rows around it are plain,
so the card is what marks the selection.

## Shared rules

- Colors come from theme tokens and must hold up in the default theme (light and dark) and one
  imported theme.
- Segmented controls and steppers are the exception once they leave the page background. Their
  track and thumb are filled from `--background` and `--input`, and themes are free to put those
  right next to `--sidebar` or `--card`, which hides the thumb. On those surfaces tint each layer
  with black or white instead, as the image sidebar does (`SIDEBAR_TRACK_CLASS`), so the contrast
  is the same in every theme.
- Radii come from the theme scale (`--radius-sm` to `--radius-xl`).
- Never hand-roll `bg-*/NN backdrop-blur-*`. If a surface needs translucency, it is glass and uses
  a recipe; if no recipe fits, add a tier to `glass.css` and the Glass guide rather than a
  one-off.
- Glass honors the per-device setting and system preferences on its own. Components never check
  them.

## Drawers

On mobile, dialogs and responsive popovers become drawers. They all behave and read the same way.

- **Background.** Every drawer is modal and sits on the glass scrim. `ResponsivePopover`'s
  `modal` prop only affects the desktop popover. The one exception is a drawer inside a surface
  that already owns a scrim (the image lightbox), which adds none of its own.
- **Dismissal.** A tap outside, a swipe down, and Back all close it. Block or confirm only when
  closing would lose work (an edited persona, an import in flight).
- **Header.** None by default: the drawer opens straight into its content, like the popover it
  replaces. Give it an `sr-only` `DrawerTitle` so it still has a name. Show a `DrawerHeader` with
  a title only when the drawer ends in a commit action, so the title says what the button will
  do. `DrawerDescription` is for assistive tech and never shows. Text the user needs in order to
  decide is body content.
- **Density.** 16px gutters. With no header, content starts 20px under the handle (`pt-5`), as
  in the usage drawer. Section labels are `text-sm font-medium`, secondary text is `text-xs`.
  Keep the full width; never give a drawer its own width, radius, or border.
- **Footer.** `DrawerFooter` is one row of equal buttons, secondary first and the commit action
  last. Add `border-t` only when the body above it scrolls.

## Guides

- [Spotlight Surfaces](./SPOTLIGHT_SURFACES.md): generated content.
- [Glass Surfaces](./GLASS_SURFACES.md): the floating material, its tiers, and its settings.
