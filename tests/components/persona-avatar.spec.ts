import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/browser-env", () => ({
    browserEnv: (key: string) => {
        if (key === "VITE_R2_PUBLIC_BASE_URL") return "https://r2-dev.silkchat.example"
        if (key === "VITE_CONVEX_API_URL") return "https://convex-dev.silkchat.example"
        throw new Error(`Unexpected environment key: ${key}`)
    },
    optionalBrowserEnv: (key: string) =>
        key === "VITE_R2_PUBLIC_BASE_URL" ? "https://r2-dev.silkchat.example" : undefined
}))

import { getPersonaAvatarSrc } from "@/components/persona-avatar"

describe("getPersonaAvatarSrc", () => {
    it("preserves portable absolute avatar URLs and resolves legacy R2 keys", () => {
        const portableUrl =
            "https://r2.silkchat.example/persona-avatars/user-1/portable-avatar.webp"

        expect(getPersonaAvatarSrc("r2", portableUrl)).toBe(portableUrl)
        expect(getPersonaAvatarSrc("r2", "persona-avatars/user-1/legacy-avatar.webp")).toBe(
            "https://r2-dev.silkchat.example/persona-avatars/user-1/legacy-avatar.webp"
        )
    })

    it("keeps built-in avatar paths unchanged", () => {
        expect(getPersonaAvatarSrc("builtin", "/personas/skitty.webp")).toBe(
            "/personas/skitty.webp"
        )
    })
})
