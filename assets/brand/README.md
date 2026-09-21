# SilkChat Shuriken assets

The completed Shuriken-in-bubble mark is the app logo. Its inner Shuriken has extra clearance from the border, including during the splash animation.

- `src/assets/shuriken.svg` preserves the symmetric four-blade source geometry.
- `src/lib/shuriken-bubble-geometry.ts` defines the shared border, tail, viewBox and inner scale.
- `src/components/shuriken-bubble.tsx` animates the same geometry used in the static assets.
- `src/logo.svg` is the generated static mark, used by UI components and the social-image renderer.
- `social-wordmark.png` preserves the wordmark and tagline cropped from the original high-resolution social artwork. It contains no old bubble symbol.

Run `bun scripts/generate-brand-assets.ts` after changing the shared geometry. This regenerates `src/logo.svg`, all seven favicon sizes, the Apple icon, maskable app icons, the email logo, and both static social images. Maskable icons reserve space for the circular safe area. It does not overwrite the separately generated dev artwork.

Favicons use the standalone four-wing Shuriken on a rounded white tile with transparent outer corners. The standalone mark fills roughly 90% of the favicon canvas, leaving about 5% clearance at the blade tips. Favicons use thicker blades, with extra weight at 16px. Installed app icons retain the completed bubble mark with heavier border, tail and blade weights. The larger brand artwork and splash retain their original geometry. Apple and maskable icons retain opaque full-bleed backgrounds so the operating system can apply its own mask.

## Developer icon

`public/dev_logo.png` was replaced using the built-in image generation tool. The old developer icon supplied its blueprint style; a raster export of the new padded logo supplied its geometry. The generated result was copied into the project without modifying the original generated file.

### Final prompt

Use case: precise-object-edit. Asset type: square SilkChat developer utility dock icon. Input 1 is the existing blue engineering blueprint icon to replace; input 2 is the exact new SilkChat logo geometry reference. Replace the old overlapping chat-bubble/pen logo in input 1 completely with the new single rounded chat bubble with smoothly integrated lower-left wing-shaped speaker tail and centered four-blade symmetric Shuriken in input 2. Preserve the new logo silhouette faithfully: exactly four curved blades inside, generous clear space around them, continuous thick bubble border and integrated sweeping lower-left tail, no extra inner hooks, no gaps. Render this new mark as a refined white/cyan engineering drawing with fine diagonal hatching and thin construction lines on the same deep blue graph-paper background as input 1. Keep strong legibility as a tiny 40px square app icon: logo dominant, ample outer safe margins, blueprint details subtle. Preserve the small bottom-left technical stamp with exact text 'DEV' and 'BUILD', and a small terminal >_ symbol. Remove the old numerical ratios, use clean unlabeled dimension arrows sparingly. Flat orthographic square artwork, crisp precision drafting, no 3D, no mockup, no extra logos, no watermark. Background opaque blue. Produce one square high-resolution final icon.
