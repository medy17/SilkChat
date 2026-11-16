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
import { useCapAlignedIcon } from "@/hooks/use-cap-aligned-icon"

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

const readFilePaths = (value: unknown) => {
    const files = (value as { files?: unknown } | null | undefined)?.files
    if (!Array.isArray(files)) return undefined
    return files.filter((file): file is string => typeof file === "string")
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
        const label = outputLabel ?? (skill ? SKILL_LABELS[skill] : undefined) ?? skill ?? "Skill"
        // An installed skill is loaded again to read one of its files.
        const files = readFilePaths(output) ?? readFilePaths(input) ?? []
        const fileNames = files.map((file) => file.split("/").pop()).join(", ")
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
        // A long list of files wraps, so the icon sits on the first line and not the middle.
        const { iconRef, textRef, marginTop } = useCapAlignedIcon<HTMLSpanElement>(Icon)

        return (
            <div
                className={`not-prose mb-6 flex items-start gap-2 ${hasFailed ? "text-destructive" : "text-primary"}`}
                role="status"
            >
                <Icon
                    ref={iconRef}
                    className="size-4 shrink-0"
                    style={{ marginTop }}
                    aria-hidden="true"
                />
                <span ref={textRef} className="min-w-0 font-medium">
                    {fileNames
                        ? hasFailed
                            ? `Failed to read ${fileNames} from ${label}`
                            : isLoading
                              ? `Reading ${fileNames} from ${label}`
                              : `Read ${fileNames} from ${label}`
                        : hasFailed
                          ? `Failed to load ${label} skill`
                          : isLoading
                            ? `Loading ${label} skill`
                            : `Loaded ${label} skill`}
                </span>
                {isLoading && (
                    <span className="flex h-lh shrink-0 items-center">
                        <DelayedSpinner key={toolInvocation.toolCallId} />
                    </span>
                )}
            </div>
        )
    }
)

SkillLoaderRenderer.displayName = "SkillLoaderRenderer"
