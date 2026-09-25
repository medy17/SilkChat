import { describe, expect, it, vi } from "vitest"
import type { PreparedImageReference } from "../../convex/lib/image_generation/shared"
import {
    ASSIGN_ROLEPLAY_PORTRAIT_TOOL_NAME,
    getAssignRoleplayPortraitTool
} from "../../convex/lib/tools/roleplay_portrait"

const references: PreparedImageReference[] = [
    {
        id: "image_ref_1",
        key: "attachments/user-1/kael.png",
        source: "attachment",
        label: "kael.png"
    }
]
// Mirrors the route's resolver: a conversation URL yields its storage key.
const extractKey = (value: string) =>
    value.startsWith("https://cdn.example.com/")
        ? value.slice("https://cdn.example.com/".length)
        : null

const run = async (input: { characterId: string; image: string }) => {
    const withName = { ...input, name: "Kael" }
    const assign = vi.fn()
    const tool = getAssignRoleplayPortraitTool({ enabled: true, references, extractKey, assign })[
        ASSIGN_ROLEPLAY_PORTRAIT_TOOL_NAME
    ]
    const result = await tool?.execute?.(withName, {
        toolCallId: "call-1",
        messages: [],
        context: {}
    })
    return { result, assign }
}

describe("assign_roleplay_portrait tool", () => {
    it("assigns a conversation image named by reference ID or by its URL", async () => {
        for (const image of [
            "image_ref_1",
            "https://cdn.example.com/attachments/user-1/kael.png"
        ]) {
            const { result, assign } = await run({ characterId: "kael", image })
            expect(result).toMatchObject({ success: true, characterId: "kael" })
            expect(assign).toHaveBeenCalledWith({
                characterId: "kael",
                storageKey: "attachments/user-1/kael.png"
            })
        }
    })

    it("never assigns images from outside the conversation or reserved characters", async () => {
        for (const input of [
            { characterId: "kael", image: "https://cdn.example.com/attachments/user-2/x.png" },
            { characterId: "kael", image: "https://evil.example.com/kael.png" },
            { characterId: "persona", image: "image_ref_1" }
        ]) {
            const { result, assign } = await run(input)
            expect(result).toMatchObject({ success: false })
            expect(assign).not.toHaveBeenCalled()
        }
    })

    it("is offered only with SilkScreen and when the conversation has images", () => {
        const assign = vi.fn()
        expect(
            getAssignRoleplayPortraitTool({ enabled: true, references: [], extractKey, assign })
        ).toEqual({})
        // Without vision there is no SilkScreen, so no portrait tool either.
        expect(
            getAssignRoleplayPortraitTool({ enabled: false, references, extractKey, assign })
        ).toEqual({})
    })
})
