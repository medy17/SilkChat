import { beforeEach, describe, expect, it, vi } from "vitest"

const { browserEnvMock, optionalBrowserEnvMock } = vi.hoisted(() => ({
    browserEnvMock: vi.fn((key: string) =>
        key === "VITE_CONVEX_API_URL" ? "https://api.example.com/" : "https://unused.example.com"
    ),
    optionalBrowserEnvMock: vi.fn((key: string) =>
        key === "VITE_R2_PUBLIC_BASE_URL" ? "https://r2.silkchat.dev" : undefined
    )
}))

vi.mock("@/lib/browser-env", () => ({
    browserEnv: browserEnvMock,
    optionalBrowserEnv: optionalBrowserEnvMock
}))

import {
    extractR2KeyFromUrl,
    getPublicR2AssetUrl,
    getR2ProxyUrl,
    resolvePublicFileUrl
} from "@/lib/r2-public-url"

describe("r2-public-url", () => {
    beforeEach(() => {
        browserEnvMock.mockImplementation((key: string) =>
            key === "VITE_CONVEX_API_URL"
                ? "https://api.example.com/"
                : "https://unused.example.com"
        )
        optionalBrowserEnvMock.mockImplementation((key: string) =>
            key === "VITE_R2_PUBLIC_BASE_URL" ? "https://r2.silkchat.dev" : undefined
        )
    })

    it("builds proxy URLs when needed for worker-backed paths", () => {
        expect(getR2ProxyUrl("folder/image key.png")).toBe(
            "https://api.example.com/r2?key=folder%2Fimage%20key.png"
        )
    })

    it("builds direct public asset URLs without duplicating the bucket path", () => {
        expect(getPublicR2AssetUrl("generations/user-1/image key.png")).toBe(
            "https://r2.silkchat.dev/generations/user-1/image%20key.png"
        )
    })

    it("extracts object keys from proxy and public URLs", () => {
        expect(
            extractR2KeyFromUrl("https://api.example.com/r2?key=attachments%2Fuser-1%2Fnotes.txt")
        ).toBe("attachments/user-1/notes.txt")
        expect(
            extractR2KeyFromUrl("https://r2.silkchat.dev/generations/user-1/image%20key.png")
        ).toBe("generations/user-1/image key.png")
    })

    it("resolves relative proxy URLs to the configured public asset URL", () => {
        expect(resolvePublicFileUrl("/r2?key=attachments%2Fuser-1%2Fnotes.txt")).toBe(
            "https://r2.silkchat.dev/attachments/user-1/notes.txt"
        )
    })

    it("falls back to proxy URLs when no public base URL is configured", () => {
        optionalBrowserEnvMock.mockReturnValue(undefined)

        expect(getPublicR2AssetUrl("attachments/user-1/notes.txt")).toBe(
            "https://api.example.com/r2?key=attachments%2Fuser-1%2Fnotes.txt"
        )
        expect(resolvePublicFileUrl("/r2?key=attachments%2Fuser-1%2Fnotes.txt")).toBe(
            "https://api.example.com/r2?key=attachments%2Fuser-1%2Fnotes.txt"
        )
    })
})
