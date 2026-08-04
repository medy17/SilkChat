import { Button } from "@/components/ui/button"
import type { AssistantConfigOverride } from "@/lib/assistant-config"
import type { ToolFailureAttempt } from "@/lib/blocked-tool-attempt"
import { useModelStore } from "@/lib/model-store"
import {
    DEFAULT_TOOL_CALL_LIMIT_PER_TURN,
    MAX_TOOL_CALL_LIMIT_PER_TURN
} from "@/lib/tool-call-limit"
import { useNavigate } from "@tanstack/react-router"
import type { UIMessage } from "ai"
import {
    ArrowRight,
    Check,
    ChevronDown,
    CircleAlert,
    LogIn,
    RotateCcw,
    Settings,
    Wrench
} from "lucide-react"
import { memo, useState } from "react"
import { RetryMenu } from "../retry-menu"

const COLLAPSED_ATTEMPT_COUNT = 2
const OTHER_CALLS_MAY_HAVE_COMPLETED = "Other tool calls may still have completed."

const getTitle = (attempts: ToolFailureAttempt[]) => {
    const malformedAttempts = attempts.filter((attempt) => attempt.reason === "malformed_tool_call")
    if (malformedAttempts.length === attempts.length) {
        return attempts.length > 1
            ? "The assistant made malformed tool calls"
            : "The assistant made a malformed tool call"
    }
    if (malformedAttempts.length > 0) return "Some tool calls could not run"
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
        case "malformed_tool_call":
            return "The assistant made a malformed tool call"
    }
}

const formatToolList = (attempts: ToolFailureAttempt[]) => {
    const labels = [...new Set(attempts.map((attempt) => attempt.toolLabel))]
    if (labels.length === 1) return labels[0]
    if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
    return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`
}

const getDescription = (attempts: ToolFailureAttempt[]) => {
    if (attempts.length === 0) return "No failed tool-call details are available."
    const malformedAttempts = attempts.filter((attempt) => attempt.reason === "malformed_tool_call")
    if (malformedAttempts.length === attempts.length) {
        if (attempts.length > 1) {
            return `${attempts.length} calls across ${formatToolList(attempts)} had incomplete or invalid arguments and did not run. ${OTHER_CALLS_MAY_HAVE_COMPLETED}`
        }
        const toolLabel = attempts[0]?.toolLabel.toLowerCase() ?? "tool"
        return `This ${toolLabel} call had incomplete or invalid arguments and did not run. ${OTHER_CALLS_MAY_HAVE_COMPLETED}`
    }
    if (malformedAttempts.length > 0) {
        return `${attempts.length} calls across ${formatToolList(attempts)} were blocked or malformed and did not run. ${OTHER_CALLS_MAY_HAVE_COMPLETED}`
    }
    if (attempts.length > 1) {
        return `${attempts.length} attempts across ${formatToolList(attempts)} were blocked and did not run. ${OTHER_CALLS_MAY_HAVE_COMPLETED}`
    }

    const attempt = attempts[0]
    switch (attempt.reason) {
        case "user_disabled":
            return `${attempt.toolLabel} is turned off, so this call did not run. ${OTHER_CALLS_MAY_HAVE_COMPLETED}`
        case "not_configured":
            return `This tool call was captured but could not run because the tool is not configured. ${OTHER_CALLS_MAY_HAVE_COMPLETED}`
        case "auth_required":
            return `This tool call was captured but requires sign-in before it can run. ${OTHER_CALLS_MAY_HAVE_COMPLETED}`
        case "deployment_unavailable":
            return `This SilkChat deployment could not run this tool call. ${OTHER_CALLS_MAY_HAVE_COMPLETED}`
        case "malformed_tool_call":
            return `This ${attempt.toolLabel.toLowerCase()} call had incomplete or invalid arguments and did not run. ${OTHER_CALLS_MAY_HAVE_COMPLETED}`
    }
}

export const BlockedToolCard = memo(
    ({
        attempts,
        retryMessage,
        onRetry,
        requiresNativePdf = false
    }: {
        attempts: ToolFailureAttempt[]
        retryMessage?: UIMessage
        onRetry?: (message: UIMessage, configOverride?: AssistantConfigOverride) => void
        requiresNativePdf?: boolean
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
        const hasMalformedAttempts = attempts.some(
            (attempt) => attempt.reason === "malformed_tool_call"
        )
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
                            {visibleAttempts.map((attempt, index) =>
                                attempt.reason === "malformed_tool_call" ? (
                                    <div
                                        key={`${attempt.toolName}-${index}`}
                                        className="flex items-start gap-2 border-border/70 border-t pt-2 text-sm first:border-t-0 first:pt-0"
                                    >
                                        <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                                        <span className="min-w-0">
                                            <span className="font-medium">{attempt.toolLabel}</span>
                                            <span className="text-muted-foreground">
                                                {attempt.summary
                                                    ? ` — ${attempt.summary}`
                                                    : " — Invalid arguments"}
                                            </span>
                                        </span>
                                    </div>
                                ) : (
                                    <details
                                        key={`${attempt.toolName}-${index}`}
                                        className="group border-border/70 border-t pt-2 first:border-t-0 first:pt-0"
                                    >
                                        <summary className="flex cursor-pointer list-none items-start gap-2 text-sm">
                                            <ChevronDown className="mt-1 size-3 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                                            <span className="min-w-0">
                                                <span className="font-medium">
                                                    {attempt.toolLabel}
                                                </span>
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
                                )
                            )}
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
                            {hasMalformedAttempts && retryMessage && onRetry && (
                                <RetryMenu
                                    onRetry={(configOverride) =>
                                        onRetry(retryMessage, configOverride)
                                    }
                                    requiresNativePdf={requiresNativePdf}
                                    triggerLabel="Retry or switch model"
                                />
                            )}
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
