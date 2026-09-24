// @vitest-environment jsdom
import { ReferenceImageThumbnails } from "@/components/library/image-metadata-panel"
import { cleanup, render, screen } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
})

describe("image reference thumbnails", () => {
    it("keeps built-in public assets out of the bucket while resolving uploaded references through R2", () => {
        vi.stubEnv("VITE_R2_PUBLIC_BASE_URL", "https://r2-dev.example.com")
        vi.stubEnv("VITE_LOCAL_IMAGE_OPTIMIZER_ENABLED", "false")
        const { container } = render(
            React.createElement(ReferenceImageThumbnails, {
                referenceImageKeys: ["/avatars/renji.webp", "persona-avatars/user-1/custom.webp"]
            })
        )
        expect(
            screen.getByRole("link", { name: "Open reference image 1" }).getAttribute("href")
        ).toBe("/avatars/renji.webp")
        expect(container.querySelectorAll("img")[0].getAttribute("src")).toBe("/avatars/renji.webp")
        expect(container.querySelectorAll("img")[0].getAttribute("srcset")).toBeNull()
        expect(
            screen.getByRole("link", { name: "Open reference image 2" }).getAttribute("href")
        ).toBe("https://r2-dev.example.com/persona-avatars/user-1/custom.webp")
        expect(container.querySelectorAll("img")[1].getAttribute("src")).toContain(
            "https://r2-dev.example.com/persona-avatars/user-1/custom.webp"
        )
    })
})
