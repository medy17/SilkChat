import { type ParsedChatError, parseChatError } from "@/lib/errors"
import { Link } from "@tanstack/react-router"
import { AlertTriangle, CreditCard, KeyRound, Lock, RotateCcw } from "lucide-react"
import { memo, useMemo } from "react"
import { Button } from "./ui/button"

type ErrorCta = {
    label: string
    to: string
}

type ErrorPresentation = {
    icon: typeof AlertTriangle
    title: string
    description?: string
    cta?: ErrorCta
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
            cta: { label: "View plans", to: "/settings/billing" }
        }
    }

    if (detail?.kind === "credits_exhausted") {
        const bucketLabel = detail.bucket === "pro" ? "Pro" : "Basic"
        const description =
            detail.bucket === "pro"
                ? "You've used all your Pro credits for this billing period. They'll reset next period, or you can upgrade your plan for more."
                : "You've used all your Basic credits for this billing period. They'll reset next period, or you can upgrade your plan for more."
        return {
            icon: CreditCard,
            title: `Out of ${bucketLabel} credits`,
            description,
            cta: { label: "Manage plan", to: "/settings/billing" }
        }
    }

    if (detail?.kind === "context_limit_exceeded") {
        if (detail.limitType === "hosted") {
            return {
                icon: KeyRound,
                title: "Hosted context limit reached",
                description:
                    "This chat is too large for hosted usage. Edit your message, switch to your OpenRouter key, or start a new chat.",
                cta: { label: "Set up BYOK", to: "/settings/providers" }
            }
        }

        return {
            icon: AlertTriangle,
            title: "Model context limit reached",
            description:
                "This chat exceeds the selected model's effective context limit. Edit your message, start a new chat, or choose a larger-context model."
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

export const ChatErrorNotice = memo(
    ({ error, onRetry }: { error: unknown; onRetry?: () => void }) => {
        const presentation = useMemo(() => describeChatError(parseChatError(error)), [error])
        const Icon = presentation.icon

        return (
            <div className="flex flex-col gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-foreground">
                <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 size-5 shrink-0 text-foreground" />
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
                    {presentation.cta && (
                        <Button asChild variant="outline" size="sm" className="text-foreground">
                            <Link to={presentation.cta.to}>{presentation.cta.label}</Link>
                        </Button>
                    )}
                    {onRetry && (
                        <Button variant="destructive" size="sm" onClick={onRetry}>
                            <RotateCcw />
                            Retry
                        </Button>
                    )}
                </div>
            </div>
        )
    }
)

ChatErrorNotice.displayName = "ChatErrorNotice"
