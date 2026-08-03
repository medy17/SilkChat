import { Button } from "@/components/ui/button"
import type { AssistantConfigOverride } from "@/lib/assistant-config"
import type { BlockedToolAttempt } from "@/lib/blocked-tool-attempt"
import { useModelStore } from "@/lib/model-store"
import {
    DEFAULT_TOOL_CALL_LIMIT_PER_TURN,
    MAX_TOOL_CALL_LIMIT_PER_TURN
} from "@/lib/tool-call-limit"
import { useNavigate } from "@tanstack/react-router"
import type { UIMessage } from "ai"
import { ArrowRight, Check, ChevronDown, LogIn, RotateCcw, Settings, Wrench } from "lucide-react"
import { memo, useState } from "react"

const COLLAPSED_ATTEMPT_COUNT = 2

const getTitle = (attempts: BlockedToolAttempt[]) => {
    if (attempts.length > 1) return "The assistant tried to use disabled tools"

    const attempt = attempts[0]
    if (!attempt) return "The assistant tried to use a tool"

    switch (attempt.reason) {
        case "user_disabled":
            return "The assistant tried to use a disabled tool"
        case "not_configured":
            return `${attempt.toolLabel} isn't configured`
        case "auth_required":
            return `Sign in to use ${attempt.toolLabel.toLowerCase()}`
        case "deployment_unavailable":
            return `${attempt.toolLabel} is unavailable`
    }
}

const formatToolList = (attempts: BlockedToolAttempt[]) => {
    const labels = [...new Set(attempts.map((attempt) => attempt.toolLabel))]
    if (labels.length === 1) return labels[0]
    if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
    return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`
}

const getDescription = (attempts: BlockedToolAttempt[]) => {
    if (attempts.length === 0) return "Nothing ran."
    if (attempts.length > 1) {
        return `${attempts.length} attempts across ${formatToolList(attempts)} were blocked. Nothing ran.`
    }

    const attempt = attempts[0]
    switch (attempt.reason) {
        case "user_disabled":
            return `${attempt.toolLabel} is turned off, so nothing ran.`
        case "not_configured":
            return "The attempted tool call was captured, but nothing ran."
        case "auth_required":
            return "The attempted tool call was captured, but nothing ran."
        case "deployment_unavailable":
            return "This SilkChat deployment cannot run that tool. Nothing ran."
    }
}

export const BlockedToolCard = memo(
    ({
        attempts,
        retryMessage,
        onRetry
    }: {
        attempts: BlockedToolAttempt[]
        retryMessage?: UIMessage
        onRetry?: (message: UIMessage, configOverride?: AssistantConfigOverride) => void
    }) => {
        const navigate = useNavigate()
        const [showAllAttempts, setShowAllAttempts] = useState(false)
        const enabledTools = useModelStore((state) => state.enabledTools)
        const setEnabledTools = useModelStore((state) => state.setEnabledTools)
        const enableableAbilities = [
            ...new Set(
                attempts
                    .filter(
                        (attempt) => attempt.reason === "user_disabled" && attempt.ability !== "mcp"
                    )
                    .map((attempt) => attempt.ability)
            )
        ]
        const areEnableableToolsEnabled = enableableAbilities.every((ability) =>
            enabledTools.includes(ability)
        )
        const hiddenAttemptCount = Math.max(0, attempts.length - COLLAPSED_ATTEMPT_COUNT)
        const visibleAttempts = showAllAttempts
            ? attempts
            : attempts.slice(0, COLLAPSED_ATTEMPT_COUNT)

        const enableTools = () => {
            const nextEnabledTools = [...enabledTools]
            for (const ability of enableableAbilities) {
                if (!nextEnabledTools.includes(ability)) nextEnabledTools.push(ability)
            }
            setEnabledTools(nextEnabledTools)
        }

        const handleEnableAndRetry = () => {
            enableTools()
            if (retryMessage) {
                onRetry?.(retryMessage, {
                    toolCallLimitFloorOverride: Math.min(
                        MAX_TOOL_CALL_LIMIT_PER_TURN,
                        Math.max(DEFAULT_TOOL_CALL_LIMIT_PER_TURN, attempts.length)
                    )
                })
            }
        }

        const setupAbilities = [
            ...new Set(
                attempts
                    .filter((attempt) => attempt.reason === "not_configured")
                    .map((attempt) => attempt.ability)
            )
        ]
        const requiresAuth = attempts.some((attempt) => attempt.reason === "auth_required")
        const hasMultipleEnableableTools = enableableAbilities.length > 1

        return (
            <div
                className="not-prose my-4 border border-border bg-muted/40 p-4"
                style={{ borderRadius: "var(--radius-md)" }}
            >
                <div className="flex items-start gap-3">
                    <div
                        className="mt-0.5 flex size-8 shrink-0 items-center justify-center bg-background text-muted-foreground"
                        style={{ borderRadius: "var(--radius-sm)" }}
                    >
                        <Wrench className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{getTitle(attempts)}</p>
                        <p className="mt-1 text-muted-foreground text-sm">
                            {getDescription(attempts)}
                        </p>

                        <div className="mt-3 space-y-2">
                            {visibleAttempts.map((attempt, index) => (
                                <details
                                    key={`${attempt.toolName}-${index}`}
                                    className="group border-border/70 border-t pt-2 first:border-t-0 first:pt-0"
                                >
                                    <summary className="flex cursor-pointer list-none items-start gap-2 text-sm">
                                        <ChevronDown className="mt-1 size-3 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                                        <span className="min-w-0">
                                            <span className="font-medium">{attempt.toolLabel}</span>
                                            {attempt.summary && (
                                                <span className="text-muted-foreground">
                                                    {` — ${attempt.summary}`}
                                                </span>
                                            )}
                                        </span>
                                    </summary>
                                    <pre
                                        className="mt-2 max-h-64 overflow-auto border border-border bg-background p-3 text-xs"
                                        style={{ borderRadius: "var(--radius-sm)" }}
                                    >
                                        {JSON.stringify(
                                            {
                                                tool: attempt.toolName,
                                                arguments: attempt.input
                                            },
                                            null,
                                            2
                                        )}
                                    </pre>
                                </details>
                            ))}
                        </div>

                        {hiddenAttemptCount > 0 && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="mt-2 px-2"
                                onClick={() => setShowAllAttempts((showAll) => !showAll)}
                            >
                                {showAllAttempts ? "Show less" : `View ${hiddenAttemptCount} more`}
                            </Button>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                            {enableableAbilities.length > 0 && retryMessage && onRetry && (
                                <Button size="sm" onClick={handleEnableAndRetry}>
                                    <RotateCcw className="size-4" />
                                    {areEnableableToolsEnabled
                                        ? "Retry now"
                                        : hasMultipleEnableableTools
                                          ? "Enable tools and retry"
                                          : "Enable and retry"}
                                </Button>
                            )}
                            {enableableAbilities.length > 0 && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={enableTools}
                                    disabled={areEnableableToolsEnabled}
                                >
                                    {areEnableableToolsEnabled ? (
                                        <Check className="size-4" />
                                    ) : (
                                        <ArrowRight className="size-4" />
                                    )}
                                    {areEnableableToolsEnabled
                                        ? "Enabled for next message"
                                        : hasMultipleEnableableTools
                                          ? "Enable tools for next message"
                                          : "Enable for next message"}
                                </Button>
                            )}
                            {setupAbilities.map((ability) => (
                                <Button
                                    key={ability}
                                    size="sm"
                                    onClick={() =>
                                        void navigate({
                                            to:
                                                ability === "supermemory"
                                                    ? "/settings/providers"
                                                    : "/settings/ai-options"
                                        })
                                    }
                                >
                                    <Settings className="size-4" />
                                    {ability === "supermemory"
                                        ? "Set up Supermemory"
                                        : "Manage MCP servers"}
                                </Button>
                            ))}
                            {requiresAuth && (
                                <Button
                                    size="sm"
                                    onClick={() =>
                                        void navigate({
                                            to: "/auth/$pathname",
                                            params: { pathname: "sign-in" }
                                        })
                                    }
                                >
                                    <LogIn className="size-4" />
                                    Sign in
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )
    }
)

BlockedToolCard.displayName = "BlockedToolCard"
