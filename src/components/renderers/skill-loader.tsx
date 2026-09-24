import type { Tool, UIToolInvocation } from "ai"
import {
    BookOpen,
    BrainCircuit,
    ChefHat,
    CircleAlert,
    Drama,
    Globe,
    Image,
    LayoutTemplate,
    Loader2,
    Network,
    Sigma,
    SquareTerminal,
    type LucideIcon
} from "lucide-react"
import { memo, useEffect, useState } from "react"

const SKILL_LABELS: Record<string, string> = {
    diagrams: "Diagrams",
    recipes: "Recipes",
    roleplay: "Roleplay",
    canvas: "Canvas",
    math: "Math Kit",
    web_search: "Web Search",
    code_execution: "Code Execution",
    memory: "Memory",
    image_generation: "SilkScreen"
}

const SKILL_ICONS: Record<string, LucideIcon> = {
    diagrams: Network,
    recipes: ChefHat,
    roleplay: Drama,
    canvas: LayoutTemplate,
    math: Sigma,
    web_search: Globe,
    code_execution: SquareTerminal,
    memory: BrainCircuit,
    image_generation: Image
}

const DelayedSpinner = () => {
    const [visible, setVisible] = useState(false)
    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), 300)
        return () => clearTimeout(timer)
    }, [])
    return visible ? (
        <Loader2 className="size-4 motion-safe:animate-spin" aria-label="Loading skill" />
    ) : null
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
        const hasFailed =
            toolInvocation.state === "output-error" ||
            toolInvocation.state === "output-denied" ||
            (output &&
                typeof output === "object" &&
                "success" in output &&
                output.success === false)
        const Icon = hasFailed ? CircleAlert : (skill && SKILL_ICONS[skill]) || BookOpen

        return (
            <div
                className={`not-prose mb-6 flex items-center gap-2 ${hasFailed ? "text-destructive" : "text-primary"}`}
                role="status"
            >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="font-medium">
                    {hasFailed
                        ? `Failed to load ${label} skill`
                        : isLoading
                          ? `Loading ${label} skill`
                          : `Loaded ${label} skill`}
                </span>
                {isLoading && <DelayedSpinner key={toolInvocation.toolCallId} />}
            </div>
        )
    }
)

SkillLoaderRenderer.displayName = "SkillLoaderRenderer"
