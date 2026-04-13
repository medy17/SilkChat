export const SELECTABLE_IMAGE_ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9"] as const

export type SelectableImageAspectRatio = (typeof SELECTABLE_IMAGE_ASPECT_RATIOS)[number]
