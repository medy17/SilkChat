import { describe, expect, it } from "vitest"
import {
    isContinuingRoleplay,
    roleplaySkill,
    shouldPreloadRoleplay
} from "../../convex/chat_http/skills/roleplay"

describe("continuing roleplay instructions", () => {
    it("preloads opted-in Persona chats before any scene and keeps the instructions on later turns", () => {
        expect(shouldPreloadRoleplay(true, [])).toBe(true)
        expect(shouldPreloadRoleplay(true, [{ role: "user", content: "Hi" }])).toBe(true)
        expect(shouldPreloadRoleplay(true, [{ role: "assistant", content: "Hello." }])).toBe(true)
        expect(shouldPreloadRoleplay(false, [{ role: "user", content: "Hi" }])).toBe(false)
        expect(shouldPreloadRoleplay(undefined, [{ role: "assistant", content: "Hello." }])).toBe(
            false
        )
        expect(
            shouldPreloadRoleplay(false, [
                { role: "assistant", content: "<roleplay>Hello.</roleplay>" }
            ])
        ).toBe(true)
    })
    it("binds the roleplay instructions to the active Persona's saved name", () => {
        const instructions = roleplaySkill.buildInstructions({
            mathKitEnabled: false,
            personaName: "Aria the Archivist"
        })
        expect(instructions).toContain('The active Persona\'s saved name is "Aria the Archivist"')
        expect(instructions).toContain('Use id="persona"')
        // The exact tag and the name-derived ID to avoid, so the example IDs are not copied.
        expect(instructions).toContain('<character id="persona" name="Aria the Archivist">')
        expect(instructions).toContain('<say id="persona">')
        expect(instructions).toContain('such as id="aria-the-archivist"')
        expect(instructions).toContain("Supporting characters must use different IDs")
        // A delegated user character always binds through its reserved ID.
        for (const personaName of ["Aria the Archivist", undefined]) {
            expect(
                roleplaySkill.buildInstructions({ mathKitEnabled: false, personaName })
            ).toContain('use the reserved id="user"')
        }
        expect(roleplaySkill.buildInstructions({ mathKitEnabled: false })).not.toContain(
            "The active Persona's saved name"
        )
    })
    it("mentions portraits only when SilkScreen is available this turn", () => {
        const withSilkScreen = roleplaySkill.buildInstructions({
            mathKitEnabled: false,
            imageGenerationEnabled: true
        })
        expect(withSilkScreen).toContain("assign_roleplay_portrait")
        expect(withSilkScreen).toContain("Example (emit directly")
        const withoutSilkScreen = roleplaySkill.buildInstructions({ mathKitEnabled: false })
        expect(withoutSilkScreen).not.toContain("portrait field")
        expect(withoutSilkScreen).not.toContain("assign_roleplay_portrait")
    })
    it("restores the skill after a scene, including after assistant tool-only steps", () => {
        expect(
            isContinuingRoleplay([
                {
                    role: "assistant",
                    content: [
                        {
                            type: "text",
                            text: '<roleplay><character name="A"><dialogue>Go.</dialogue></character></roleplay>'
                        }
                    ]
                },
                { role: "user", content: "I follow her." },
                {
                    role: "assistant",
                    content: [
                        {
                            type: "tool-call",
                            toolCallId: "1",
                            toolName: "load_skill",
                            input: { skill: "roleplay" }
                        }
                    ]
                }
            ])
        ).toBe(true)
    })
    it("does not preload from user examples, assistant code examples, or an old scene after an unrelated answer", () => {
        const scene = "<roleplay>Hello</roleplay>"
        expect(isContinuingRoleplay([{ role: "user", content: scene }])).toBe(false)
        expect(
            isContinuingRoleplay([{ role: "assistant", content: `\`\`\`xml\n${scene}\n\`\`\`` }])
        ).toBe(false)
        expect(
            isContinuingRoleplay([
                { role: "assistant", content: scene },
                { role: "assistant", content: "Four." }
            ])
        ).toBe(false)
    })
    it("supplies presentation instructions, with portrait assignment as its only tool", () => {
        expect(roleplaySkill.toolNames).toEqual(["assign_roleplay_portrait"])
        expect(roleplaySkill.buildInstructions({ mathKitEnabled: false })).toContain(
            '<character id="adelle" name="Adelle">'
        )
        expect(roleplaySkill.buildInstructions({ mathKitEnabled: false })).toContain(
            "without surrounding quotation marks"
        )
    })
})
