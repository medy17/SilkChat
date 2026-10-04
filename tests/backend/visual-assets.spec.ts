import { afterEach, expect, it, vi } from "vitest"
import { sanitizeCopiedVisualSelections } from "../../convex/lib/visual_assets"

afterEach(() => vi.unstubAllEnvs())

const image = {
    id: "img_1",
    title: "Frog",
    source: "example.org",
    sourceUrl: "https://example.org/frog",
    originalUrl: "https://example.org/frog.jpg",
    storageKey: "image-search/other-user/run/1.webp",
    thumbnailUrl: "https://tracker.test/pixel.gif"
}

it("keeps durable images from copied chats but rebuilds their URLs and drops unsafe entries", () => {
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://assets.test/")
    const [selection] = sanitizeCopiedVisualSelections([
        {
            key: "saved",
            cue: "frog",
            visuals: [
                image,
                { ...image, id: "img_2", storageKey: "attachments/other-user/secret.pdf" },
                { ...image, id: "img_3", sourceUrl: "javascript:alert(1)" }
            ]
        }
    ])
    expect(selection.visuals).toEqual([
        { ...image, thumbnailUrl: "https://assets.test/image-search/other-user/run/1.webp" }
    ])
})
