import type { UIToolInvocation } from "ai"
import { SquareTerminal } from "lucide-react"

/**
 * Timed workspaces were replaced by Silky's computer, but old messages still hold their
 * request cards. Nothing can act on one now, so this only records that it happened.
 */
export function LegacyWorkspaceCard({
    toolInvocation
}: {
    toolInvocation: UIToolInvocation<{ input: unknown; output: unknown }>
}) {
    const output = toolInvocation.output as { title?: unknown } | null | undefined
    const title = typeof output?.title === "string" ? output.title.trim() : ""

    return (
        <p className="not-prose my-3 flex items-center gap-2 text-muted-foreground text-sm">
            <SquareTerminal className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate">{title || "Workspace"}</span>
        </p>
    )
}
