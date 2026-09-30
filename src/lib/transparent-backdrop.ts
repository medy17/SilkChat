import type { Doc } from "@/convex/_generated/dataModel"

export type TransparentBackdrop = "light" | "dark" | "checker"

export const TRANSPARENT_BACKDROP_OPTIONS: {
    value: TransparentBackdrop
    label: string
    className: string
}[] = [
    { value: "light", label: "White", className: "transparent-backdrop-light" },
    { value: "dark", label: "Black", className: "transparent-backdrop-dark" },
    { value: "checker", label: "Checker", className: "transparent-backdrop-checker" }
]

/** Background class for an <img>; it paints through the alpha. Opaque images get none. */
export const getTransparentBackdropClassName = (
    image?: Pick<Doc<"generatedImages">, "transparentBackground"> | null,
    backdrop: TransparentBackdrop = "checker"
) => {
    if (!image?.transparentBackground) return undefined

    return TRANSPARENT_BACKDROP_OPTIONS.find((option) => option.value === backdrop)?.className
}
