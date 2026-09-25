import type { Tool, UIToolInvocation } from "ai"
import { CircleAlert, Loader2, UserRound } from "lucide-react"
import { memo } from "react"

// One status line for assign_roleplay_portrait, styled like the skill loader. The
// portrait appearing in the scene is the real confirmation; this explains failures.
export const RoleplayPortraitAssignmentRenderer = memo(
    ({ toolInvocation }: { toolInvocation: UIToolInvocation<Tool> }) => {
        const input = "input" in toolInvocation ? toolInvocation.input : undefined
        const output = "output" in toolInvocation ? toolInvocation.output : undefined
        const name =
            input && typeof input === "object" && "name" in input && input.name
                ? String(input.name)
                : "the character"
        const isLoading =
            toolInvocation.state === "input-streaming" || toolInvocation.state === "input-available"
        const error =
            toolInvocation.state === "output-error" || toolInvocation.state === "output-denied"
                ? "Couldn't set the portrait"
                : output && typeof output === "object" && "success" in output && !output.success
                  ? "error" in output && typeof output.error === "string"
                      ? output.error
                      : "Couldn't set the portrait"
                  : undefined

        return (
            <div
                className={`not-prose mb-6 flex items-center gap-2 ${error ? "text-destructive" : "text-primary"}`}
                role="status"
            >
                {error ? (
                    <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                ) : isLoading ? (
                    <Loader2
                        className="size-4 shrink-0 motion-safe:animate-spin"
                        aria-hidden="true"
                    />
                ) : (
                    <UserRound className="size-4 shrink-0" aria-hidden="true" />
                )}
                <span className="font-medium">
                    {error ?? (isLoading ? `Setting ${name}'s portrait` : `Set ${name}'s portrait`)}
                </span>
            </div>
        )
    }
)

RoleplayPortraitAssignmentRenderer.displayName = "RoleplayPortraitAssignmentRenderer"
