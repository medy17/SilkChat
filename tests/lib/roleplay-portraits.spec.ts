import {
    MAX_ROLEPLAY_PORTRAITS,
    getRoleplayPortraitIdError,
    parseRoleplayPortraits,
    upsertRoleplayPortrait
} from "@/lib/roleplay-portraits"
import { describe, expect, it } from "vitest"

describe("roleplay portraits", () => {
    it("imports only valid supporting-character storage keys and drops account-specific image IDs", () => {
        expect(
            parseRoleplayPortraits(
                JSON.stringify([
                    {
                        characterId: "kael",
                        storageKey: "roleplay-portraits/user-1/crop.webp",
                        generatedImageId: "old-account-image"
                    },
                    { characterId: "user", storageKey: "attachments/user-1/photo.png" },
                    { characterId: "rook", storageKey: "https://example.com/x.png" },
                    { characterId: "mara", storageKey: "attachments/user-1/../bad.png" }
                ])
            )
        ).toEqual([{ characterId: "kael", storageKey: "roleplay-portraits/user-1/crop.webp" }])
        expect(parseRoleplayPortraits("broken json")).toEqual([])
    })
    it("keeps the Persona and user portraits out of the registry", () => {
        expect(getRoleplayPortraitIdError("persona")).toBeDefined()
        expect(getRoleplayPortraitIdError("user")).toBeDefined()
        expect(getRoleplayPortraitIdError("aria-stranger")).toBeUndefined()
        // IDs are matched exactly as the markup writes them.
        expect(getRoleplayPortraitIdError(" kael")).toBeDefined()
        expect(getRoleplayPortraitIdError('kael"')).toBeDefined()
    })

    it("replaces a character's portrait instead of adding a second one", () => {
        const portraits = upsertRoleplayPortrait(
            [
                { characterId: "kael", storageKey: "generations/user-1/old.png" },
                { characterId: "rook", storageKey: "generations/user-1/rook.png" }
            ],
            { characterId: "kael", storageKey: "persona-avatars/user-1/new.webp" }
        )
        expect(portraits).toEqual([
            { characterId: "rook", storageKey: "generations/user-1/rook.png" },
            { characterId: "kael", storageKey: "persona-avatars/user-1/new.webp" }
        ])
    })

    it("caps new characters but still lets existing ones be replaced at the limit", () => {
        const full = Array.from({ length: MAX_ROLEPLAY_PORTRAITS }, (_, index) => ({
            characterId: `npc-${index}`,
            storageKey: `generations/user-1/${index}.png`
        }))
        expect(() =>
            upsertRoleplayPortrait(full, { characterId: "extra", storageKey: "x" })
        ).toThrow()
        expect(
            upsertRoleplayPortrait(full, { characterId: "npc-0", storageKey: "y" })
        ).toHaveLength(MAX_ROLEPLAY_PORTRAITS)
    })
})
