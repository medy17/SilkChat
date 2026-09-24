import { describe, expect, it } from "vitest"
import { getPortraitStyleSource } from "../../convex/lib/image_generation/portrait_reference"

describe("portrait style reference", () => {
    it("allows missing avatars and only auto-selects saved Persona assets", () => {
        expect(getPortraitStyleSource()).toBeUndefined()
        expect(getPortraitStyleSource("r2", "https://other.example.com/avatar.png")).toBeUndefined()
        expect(getPortraitStyleSource("builtin", "/unknown.webp")).toBeUndefined()
        expect(getPortraitStyleSource("builtin", "/avatars/seraphine.webp")).toEqual({
            key: "/avatars/seraphine.webp",
            url: "https://silkchat.dev/avatars/seraphine.webp"
        })
        expect(getPortraitStyleSource("r2", "persona-avatars/user-1/avatar.webp")).toEqual({
            key: "persona-avatars/user-1/avatar.webp"
        })
    })
})
