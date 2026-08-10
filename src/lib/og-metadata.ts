import type { OgDemo } from "@/lib/og-content"

// Bump this value whenever static OG artwork or copy changes.
export const STATIC_OG_VERSION = "20260810-1"

export function staticOgImageUrl(
    siteUrl: string,
    demo: Exclude<OgDemo, "shared">,
    format?: "landscape"
) {
    const searchParams = new URLSearchParams({
        demo,
        ...(format ? { format } : {}),
        v: STATIC_OG_VERSION
    })
    return `${siteUrl}/api/og?${searchParams}`
}
