import type { SharedModel } from "@/convex/lib/models"
import { useIsMobile } from "@/hooks/use-mobile"
import { type ParsedChatError, type SuggestedModel, parseChatError } from "@/lib/errors"
import { useSharedModels } from "@/lib/shared-models"
import { Link, useNavigate } from "@tanstack/react-router"
import { AlertTriangle, CreditCard, Key, Lock, Pencil, RotateCcw } from "lucide-react"
import { memo, useCallback, useMemo } from "react"
import { getProviderIcon } from "./model-selector"
import { Button } from "./ui/button"

type ErrorCta = {
    label: string
    icon?: typeof AlertTriangle
    /** Navigate to a route. Mutually exclusive with {@link ErrorCta.action}. */
    to?: string
    /** Trigger an in-app action instead of navigating to a route. */
    action?: "new_chat"
}

type ErrorPresentation = {
    icon: typeof AlertTriangle
    title: string
    description?: string
    /** The recommended action, rendered as the most prominent button. */
    primaryCta?: ErrorCta
    /** An optional alternative action, rendered with lower emphasis. */
    secondaryCta?: ErrorCta
    /** Cheaper/larger models offered as one-click switches, shown as a chip row. */
    suggestedModels?: SuggestedModel[]
}

const PLAN_LABEL: Record<"free" | "pro", string> = {
    free: "Free",
    pro: "Pro"
}

const FEATURE_NOUN: Record<"chat" | "image" | "tool", string> = {
    chat: "model",
    image: "image model",
    tool: "tool"
}

/**
 * Translate a parsed chat error into a specific, actionable notice. Falls back
 * to the backend-supplied cause/message, then to a generic line.
 */
function describeChatError(parsed: ParsedChatError | null): ErrorPresentation {
    const detail = parsed?.detail

    if (detail?.kind === "plan_required") {
        const noun = FEATURE_NOUN[detail.feature ?? "chat"]
        return {
            icon: Lock,
            title: `${PLAN_LABEL[detail.requiredPlan]} plan required`,
            description: `Your ${PLAN_LABEL[detail.currentPlan ?? "free"]} plan doesn't include the selected ${noun}. Upgrade to ${PLAN_LABEL[detail.requiredPlan]} to use it, or pick a different ${noun}.`,
            primaryCta: { label: "View plans", to: "/settings/billing" }
        }
    }

    if (detail?.kind === "usage_limit_exceeded") {
        const isFiveHour = detail.window === "five_hour"
        const recovery =
            isFiveHour && detail.recoversAt
                ? new Intl.DateTimeFormat(undefined, {
                      hour: "numeric",
                      minute: "2-digit"
                  }).format(new Date(detail.recoversAt))
                : null
        return {
            icon: CreditCard,
            title: isFiveHour ? "5-hour limit reached" : "Monthly limit reached",
            description: isFiveHour
                ? `Your 5-hour window ${recovery ? `resets at ${recovery}` : "resets within a few hours"}. You can wait, pick a cheaper model, or continue with BYOK.`
                : "You've depleted your usage for this billing period. You can continue with BYOK until it renews.",
            primaryCta: { label: "Set up BYOK", to: "/settings/providers", icon: Key },
            secondaryCta: { label: "Manage plan", to: "/settings/billing" }
        }
    }

    if (detail?.kind === "context_limit_exceeded") {
        if (detail.limitType === "hosted") {
            return {
                icon: AlertTriangle,
                title: "This thread is too long",
                description:
                    "This thread is too long. Edit your message, start a new chat, or switch to BYOK.",
                primaryCta: { label: "New Chat", action: "new_chat", icon: Pencil },
                secondaryCta: { label: "Set up BYOK", to: "/settings/providers", icon: Key },
                suggestedModels: detail.suggestedModels
            }
        }

        return {
            icon: AlertTriangle,
            title: "This thread is too long",
            description:
                "This thread is too long for the selected model. Edit your message, start a new chat, or pick a model that supports longer chats.",
            primaryCta: { label: "New Chat", action: "new_chat", icon: Pencil },
            suggestedModels: detail.suggestedModels
        }
    }

    // Fall back to whatever the backend told us, preferring the specific cause.
    const fallback = parsed?.cause || parsed?.message
    return {
        icon: AlertTriangle,
        title: "Something went wrong",
        description:
            fallback && fallback !== "Something went wrong. Please try again later."
                ? fallback
                : "We couldn't complete your request. Please try again."
    }
}

/** Mirror the sidebar's "New Chat" behavior: reset composer state, then route home. */
function useStartNewChat() {
    const navigate = useNavigate()
    return useCallback(() => {
        document.dispatchEvent(new CustomEvent("new_chat"))
        void navigate({ to: "/" })
    }, [navigate])
}

export const ChatErrorNotice = memo(
    ({
        error,
        onRetry,
        onSwitchModel
    }: {
        error: unknown
        onRetry?: () => void
        onSwitchModel?: (modelId: string) => void
    }) => {
        const presentation = useMemo(() => describeChatError(parseChatError(error)), [error])
        const Icon = presentation.icon
        const startNewChat = useStartNewChat()
        const isMobile = useIsMobile()
        const { models: sharedModels } = useSharedModels()
        const sharedModelsById = useMemo(
            () => new Map((sharedModels as SharedModel[]).map((model) => [model.id, model])),
            [sharedModels]
        )
        const suggestedModels = presentation.suggestedModels ?? []
        // Keep the row compact on mobile.
        const visibleSuggestions = isMobile ? suggestedModels.slice(0, 2) : suggestedModels

        const renderCta = (cta: ErrorCta, variant: "default" | "outline") => {
            const CtaIcon = cta.icon
            if (cta.action === "new_chat") {
                return (
                    <Button variant={variant} size="sm" onClick={startNewChat}>
                        {CtaIcon && <CtaIcon />}
                        {cta.label}
                    </Button>
                )
            }
            if (cta.to) {
                return (
                    <Button asChild variant={variant} size="sm" className="text-foreground">
                        <Link to={cta.to}>
                            {CtaIcon && <CtaIcon />}
                            {cta.label}
                        </Link>
                    </Button>
                )
            }
            return null
        }

        return (
            <div className="flex flex-col gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-foreground">
                <div className="flex items-start gap-3">
                    <Icon className="mt-2 size-5 shrink-0 text-destructive" />
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="font-medium text-foreground">{presentation.title}</p>
                        {presentation.description && (
                            <p className="text-muted-foreground text-sm">
                                {presentation.description}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                    {presentation.secondaryCta && renderCta(presentation.secondaryCta, "outline")}
                    {presentation.primaryCta && renderCta(presentation.primaryCta, "default")}
                    {onRetry && (
                        <Button variant="destructive" size="sm" onClick={onRetry}>
                            <RotateCcw />
                            Retry
                        </Button>
                    )}
                </div>

                {onSwitchModel && visibleSuggestions.length > 0 && (
                    <div className="flex flex-col gap-2 border-destructive/30 border-t pt-3">
                        <span className="text-muted-foreground text-sm">Or continue with:</span>
                        <div className="flex flex-wrap gap-2">
                            {visibleSuggestions.map((model) => {
                                const sharedModel = sharedModelsById.get(model.id)
                                return (
                                    <Button
                                        key={model.id}
                                        variant="outline"
                                        size="sm"
                                        className="text-foreground"
                                        onClick={() => onSwitchModel(model.id)}
                                    >
                                        {sharedModel && getProviderIcon(sharedModel, false)}
                                        {model.name}
                                    </Button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        )
    }
)

ChatErrorNotice.displayName = "ChatErrorNotice"
