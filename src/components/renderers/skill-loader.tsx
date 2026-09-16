import type { Tool, UIToolInvocation } from "ai"
import { BookOpen, Loader2 } from "lucide-react"
import { memo } from "react"

const SKILL_LABELS: Record<string, string> = {
    diagrams: "Diagrams",
    recipes: "Recipes",
    canvas: "Canvas",
    math: "Math Kit",
    web_search: "Web Search",
    code_execution: "Code Execution",
    memory: "Memory",
    image_generation: "SilkScreen"
}

export const SkillLoaderRenderer = memo(
    ({ toolInvocation }: { toolInvocation: UIToolInvocation<Tool> }) => {
        const input = "input" in toolInvocation ? toolInvocation.input : undefined
        const output = "output" in toolInvocation ? toolInvocation.output : undefined
        const skill =
            input && typeof input === "object" && "skill" in input ? String(input.skill) : undefined
        const outputLabel =
            output && typeof output === "object" && "label" in output
                ? String(output.label)
                : undefined
        const label = outputLabel ?? (skill ? SKILL_LABELS[skill] : undefined) ?? "Skill"
        const isLoading =
            toolInvocation.state === "input-streaming" || toolInvocation.state === "input-available"

        return (
            <div className="not-prose mb-6 flex items-center gap-2 text-primary">
                <BookOpen className="size-4" />
                <span className="font-medium">
                    {isLoading ? `Loading ${label} skill` : `Loaded ${label} skill`}
                </span>
                {isLoading && <Loader2 className="size-4 animate-spin" />}
            </div>
        )
    }
)

SkillLoaderRenderer.displayName = "SkillLoaderRenderer"
