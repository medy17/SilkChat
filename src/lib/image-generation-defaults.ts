export const IMAGE_RESOLUTION_OPTIONS = ["1K", "2K", "4K"] as const
export type ImageDefaultResolution = (typeof IMAGE_RESOLUTION_OPTIONS)[number]

// Soft preference only — the backend clamps it to whatever the chosen model supports, so
// a generous ceiling here is safe. Explicit per-message requests aren't bound by this.
export const MAX_DEFAULT_VARIANTS = 4
