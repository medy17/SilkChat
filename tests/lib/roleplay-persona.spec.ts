import { describe, expect, it } from "vitest"
import { matchRoleplayPersona, selectRoleplayPersona } from "@/lib/roleplay-persona"

const persona = {
    name: "Aria the Archivist",
    shortName: "Aria",
    avatarKind: "builtin" as const,
    avatarValue: "/avatars/aria.webp"
}

describe("roleplay Persona binding", () => {
    it("binds only the reserved identity, never full names, short names, or missing IDs", () => {
        expect(matchRoleplayPersona("persona", persona)).toBe(persona)
        for (const id of [
            persona.name,
            persona.shortName,
            "aria-stranger",
            "Persona",
            "",
            undefined
        ]) {
            expect(matchRoleplayPersona(id, persona)).toBeUndefined()
        }
        expect(matchRoleplayPersona("persona")).toBeUndefined()
    })
    it("uses the composer only before creation and never leaks it into an existing thread", () => {
        const saved = { ...persona, avatarValue: "/avatars/saved.webp" }
        expect(selectRoleplayPersona({ hasThread: false, selected: persona })).toBe(persona)
        expect(selectRoleplayPersona({ hasThread: true, saved, selected: persona })).toBe(saved)
        expect(selectRoleplayPersona({ hasThread: true, selected: persona })).toBeUndefined()
        expect(
            selectRoleplayPersona({ hasThread: true, saved: null, selected: persona })
        ).toBeUndefined()
        expect(selectRoleplayPersona({ hasThread: false })).toBeUndefined()
    })
})
