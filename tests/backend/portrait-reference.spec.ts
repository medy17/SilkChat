import { describe, expect, it } from "vitest"
import {
    getPortraitStyleSource,
    getPublicPortraitReferenceUrl
} from "../../convex/lib/image_generation/portrait_reference"

describe("portrait style reference", () => {
    it("allows missing avatars and only auto-selects saved Persona assets", () => {
        expect(getPortraitStyleSource()).toBeUndefined()
        expect(getPortraitStyleSource("r2", "https://other.example.com/avatar.png")).toBeUndefined()
        expect(getPortraitStyleSource("builtin", "/unknown.webp")).toBeUndefined()
        expect(getPortraitStyleSource("builtin", "/avatars/seraphine.webp")).toEqual({
            kind: "builtin",
            key: "/avatars/seraphine.webp"
        })
        expect(getPortraitStyleSource("r2", "persona-avatars/user-1/avatar.webp")).toEqual({
            kind: "r2",
            key: "persona-avatars/user-1/avatar.webp"
        })
    })
    it("uses the configured app origin without substituting a bucket or another deployment", () => {
        for (const origin of [
            "https://app.example.com",
            "https://staging.example.com",
            "https://dev.example.com"
        ]) {
            expect(getPublicPortraitReferenceUrl("/avatars/renji.webp", origin)).toBe(
                `${origin}/avatars/renji.webp`
            )
        }
        expect(() => getPublicPortraitReferenceUrl("/avatars/renji.webp")).toThrow("not configured")
    })
})
