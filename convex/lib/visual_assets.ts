import type { VisualSelection } from "../../src/lib/visual-selections"

// Copied and imported selections are display-only. Keep durable search images,
// rebuild their URLs from the key, and drop anything that could point elsewhere.
export const sanitizeCopiedVisualSelections = (selections: VisualSelection[]) => {
    const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "")
    return selections.map((selection) => ({
        ...selection,
        visuals: base
            ? selection.visuals
                  .filter(
                      (image) =>
                          image.storageKey.startsWith("image-search/") &&
                          image.sourceUrl.startsWith("https://")
                  )
                  .map((image) => ({
                      ...image,
                      thumbnailUrl: `${base}/${image.storageKey.split("/").map(encodeURIComponent).join("/")}`
                  }))
            : []
    }))
}
