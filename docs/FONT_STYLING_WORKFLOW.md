# Font Styling Workflow

This repo uses a small shared font override system for theme-level font changes.

The source of truth is:

- [`src/lib/theme-font-config.ts`](../src/lib/theme-font-config.ts)

That file owns:

- Local theme font definitions
- Built-in tweakcn theme font overrides
- The default sans stack used by the base/default theme
- Generated `@font-face` CSS
- Font preload metadata
- The list of local font families that should not be fetched from Google Fonts

## Current Flow

1. Define local fonts in `LOCAL_THEME_FONTS`.
2. Define built-in theme exceptions in `BUILT_IN_THEME_FONT_OVERRIDES`.
3. The default built-in theme reads its sans stack from `DEFAULT_THEME_SANS_FONT_STACK`.
4. `theme-utils` applies built-in theme overrides when tweakcn themes are fetched.
5. `ThemeFontStyles` injects `@font-face` rules from config.
6. `__root.tsx` adds preload links for local font assets from config.
7. Theme font loaders use the same config so local fonts are not requested from Google Fonts.

## Add A Font Override For Another Tweakcn Theme

Do this in `src/lib/theme-font-config.ts`.

1. Add a constant for the theme URL.
2. Add an entry in `BUILT_IN_THEME_FONT_OVERRIDES`.
3. Override the token you need, usually `"font-sans"`.

Example:

```ts
export const MY_THEME_URL = "https://tweakcn.com/editor/theme?theme=my-theme"

export const BUILT_IN_THEME_FONT_OVERRIDES = {
    [T3_CHAT_THEME_URL]: {
        "font-sans": LOCAL_THEME_FONTS.proximaVara.stack
    },
    [MY_THEME_URL]: {
        "font-sans": LOCAL_THEME_FONTS.proximaVara.stack
    }
} as const
```

That is enough if the override should use an already-registered local font.

## Add A New Local Font

1. Put the font asset in `public/fonts`.
2. Add a new entry to `LOCAL_THEME_FONTS`.
3. Reference that font’s `.stack` from `BUILT_IN_THEME_FONT_OVERRIDES` or from the default theme stack if needed.

Example:

```ts
myFont: {
    family: "MyFont",
    stack: '"MyFont", sans-serif',
    sources: [
        {
            path: "/fonts/my-font.woff2",
            format: "woff2",
            mimeType: "font/woff2"
        }
    ],
    display: "swap",
    weight: "400 700",
    style: "normal"
}
```

Once added there:

- `@font-face` is generated automatically
- preload links are generated automatically
- the font is treated as local by the runtime theme loaders

## Change The Default Base Theme Font

The base/default theme font is controlled by:

- `DEFAULT_THEME_SANS_FONT_STACK` in `src/lib/theme-font-config.ts`

That constant is used by:

- `src/lib/theme-store.ts` for the built-in default theme preset

This is intentionally separate from built-in tweakcn overrides so the global default theme and specific fetched themes can evolve independently.

## Files Involved

- [`src/lib/theme-font-config.ts`](../src/lib/theme-font-config.ts): font registry, theme exception map, generated font CSS/preload data
- [`src/lib/theme-store.ts`](../src/lib/theme-store.ts): default theme preset uses the shared default font stack
- [`src/lib/theme-utils.ts`](../src/lib/theme-utils.ts): applies built-in tweakcn theme font overrides
- [`src/components/theme-font-styles.tsx`](../src/components/theme-font-styles.tsx): injects generated `@font-face`
- [`src/routes/__root.tsx`](../src/routes/__root.tsx): preloads local font assets
- [`src/lib/theme-font-loader.ts`](../src/lib/theme-font-loader.ts): skips Google Fonts loading for local theme fonts
- [`src/components/theme-script.tsx`](../src/components/theme-script.tsx): applies local-font rules during first-paint bootstrap

## Practical Rule

If you want to change fonts for a theme, do not hardcode it in:

- `globals.css`
- `theme-script.tsx`
- `theme-font-loader.ts`
- fetched theme handling directly

Put it in `theme-font-config.ts` and let the rest of the system consume it.
