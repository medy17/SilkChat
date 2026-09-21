import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import {
    buildSkillIndexContext,
    getActiveSkillToolNames,
    getLoadSkillTool,
    getPublicSkillLoadResult,
    guardSkillTools,
    resolveAvailableSkillIds,
    type AppSkillId
} from "../../convex/chat_http/skills"

const skillContext = {
    mathKitEnabled: false,
    availableImageSelectionSummary: "- None"
}

describe("application skills", () => {
    it("includes preloaded instructions and lists only remaining skills as unloaded", () => {
        const index = buildSkillIndexContext(
            ["diagrams", "web_search"],
            new Set(["web_search"]),
            skillContext
        )
        expect(index).toContain("already loaded for this turn")
        expect(index).toContain("## Web Search Tool")
        expect(index).not.toContain("`web_search` —")
        expect(index).toContain("`diagrams` —")
    })
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

    it("exposes only loaded skills' registered tools and retains them across steps", async () => {
        const loadedSkillIds = new Set<AppSkillId>()
        const availableSkillIds: AppSkillId[] = ["web_search", "math", "diagrams"]
        const tools = {
            ...getLoadSkillTool({
                availableSkillIds,
                context: skillContext,
                onLoad: (skillId) => loadedSkillIds.add(skillId)
            }),
            web_search: { inputSchema: z.object({ query: z.string() }) },
            execute_math: { inputSchema: z.object({ code: z.string() }) },
            render_chart: { inputSchema: z.object({}) },
            unrelated: { inputSchema: z.object({}) }
        }
        const activeTools = () =>
            getActiveSkillToolNames({ tools, availableSkillIds, loadedSkillIds })
        const initialTools = activeTools()
        expect(initialTools).toEqual(["load_skill", "unrelated"])

        await tools.load_skill.execute?.({ skill: "web_search" }, {} as never)
        expect(activeTools()).toEqual(["load_skill", "web_search", "unrelated"])
        expect(initialTools).toEqual(["load_skill", "unrelated"])

        await tools.load_skill.execute?.({ skill: "math" }, {} as never)
        expect(activeTools()).toEqual([
            "load_skill",
            "web_search",
            "execute_math",
            "render_chart",
            "unrelated"
        ])
        // Formatting-only skills add instructions, not nonexistent tool definitions.
        await tools.load_skill.execute?.({ skill: "diagrams" }, {} as never)
        expect(activeTools()).toEqual([
            "load_skill",
            "web_search",
            "execute_math",
            "render_chart",
            "unrelated"
        ])
        expect(
            getActiveSkillToolNames({
                tools,
                availableSkillIds,
                loadedSkillIds: new Set()
            })
        ).toEqual(initialTools)
    })

    it("rejects execution before the skill is loaded", async () => {
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
