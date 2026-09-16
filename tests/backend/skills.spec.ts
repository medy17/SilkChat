import { describe, expect, it, vi } from "vitest"
import {
    buildSkillIndexContext,
    getLoadSkillTool,
    getPublicSkillLoadResult,
    guardSkillTools,
    resolveAvailableSkillIds
} from "../../convex/chat_http/skills"

const skillContext = {
    mathKitEnabled: false,
    availableImageSelectionSummary: "- None"
}

describe("application skills", () => {
    it("only indexes user-enabled abilities while retaining native formats", () => {
        const skillIds = resolveAvailableSkillIds({
            enabledTools: ["web_search"],
            imageGenerationEnabled: false
        })

        expect(skillIds).toEqual(["diagrams", "recipes", "canvas", "web_search"])

        const index = buildSkillIndexContext(skillIds)
        expect(index).toContain("`web_search` — Use only for explicit web requests")
        expect(index).toContain("Availability is not a suggestion to use them")
        expect(index).toContain(
            "Never load for a stable factual question merely because it is niche, technical, or worth verifying"
        )
        expect(index).not.toContain("`code_execution`")
        expect(index).not.toContain("`image_generation`")
    })

    it("returns full instructions to the model and a compact public result", async () => {
        const onLoad = vi.fn()
        const loader = getLoadSkillTool({
            availableSkillIds: ["diagrams", "web_search"],
            context: skillContext,
            onLoad
        }).load_skill

        const result = await loader.execute?.({ skill: "diagrams" }, {
            toolCallId: "skill-1"
        } as never)

        expect(onLoad).toHaveBeenCalledWith("diagrams")
        expect(result).toMatchObject({
            success: true,
            skill: "diagrams",
            label: "Diagrams",
            message: "Loaded Diagrams skill for this turn.",
            instructions: expect.stringContaining("## Mermaid Diagrams")
        })
        expect(getPublicSkillLoadResult(result)).toEqual({
            success: true,
            skill: "diagrams",
            label: "Diagrams",
            message: "Loaded Diagrams skill for this turn."
        })
    })

    it("keeps tool schemas stable but rejects execution before the skill is loaded", async () => {
        const execute = vi.fn().mockResolvedValue({ ok: true })
        const loadedSkillIds = new Set<"web_search">()
        const guarded = guardSkillTools({
            tools: {
                web_search: { execute } as never,
                unrelated: { execute } as never
            },
            availableSkillIds: ["web_search"],
            loadedSkillIds
        })

        await expect(guarded.web_search.execute?.({} as never, {} as never)).rejects.toThrow(
            "Load the Web Search skill"
        )
        await guarded.unrelated.execute?.({} as never, {} as never)
        expect(execute).toHaveBeenCalledTimes(1)

        loadedSkillIds.add("web_search")
        await expect(guarded.web_search.execute?.({} as never, {} as never)).resolves.toEqual({
            ok: true
        })
    })
})
