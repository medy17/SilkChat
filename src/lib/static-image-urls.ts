// Optimization for static assets served from the app's own origin (files under
// `/public`, e.g. persona avatars and genre showcase art). These are NOT R2
// generated images, so they don't go through the Cloudflare `cdn-cgi` pipeline in
// `@/lib/generated-image-urls` — that path expects an absolute R2 source URL and
// the local optimizer explicitly rejects non-R2/Convex sources. Instead we lean on
// Vercel's built-in image optimizer (`/_vercel/image`), already configured in
// `vercel.json`, which resizes and re-encodes same-origin assets to avif/webp.

// Must stay in sync with the `images.sizes` list in `vercel.json`. Vercel returns a
// 400 for any `w` that isn't in that allowlist, so callers' widths are snapped to
// the nearest configured size at or above the requested width.
const VERCEL_IMAGE_SIZES = [320, 384, 480, 576, 640, 768, 960, 1080, 1200, 1600] as const

export const snapToVercelImageSize = (width: number) =>
    VERCEL_IMAGE_SIZES.find((size) => size >= width) ??
    VERCEL_IMAGE_SIZES[VERCEL_IMAGE_SIZES.length - 1]

export const buildVercelOptimizedImageUrl = ({
    src,
    width,
    quality = 75
}: {
    src: string
    width: number
    quality?: number
}) => `/_vercel/image?url=${encodeURIComponent(src)}&w=${snapToVercelImageSize(width)}&q=${quality}`

export const getOptimizedStaticImageUrl = (args: {
    src: string
    width: number
    quality?: number
}) =>
    // `/_vercel/image` only exists on Vercel; under local `vite dev` the raw asset
    // is served directly, so fall back to the original path there.
    import.meta.env.DEV ? args.src : buildVercelOptimizedImageUrl(args)
