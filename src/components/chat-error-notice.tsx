import type { SharedModel } from "@/convex/lib/models"
import { useIsMobile } from "@/hooks/use-mobile"
import {
    type ParsedChatError,
    type ProviderErrorCategory,
    type SuggestedModel,
    parseChatError
} from "@/lib/errors"
import { type ProviderErrorDetail, getProviderErrorCopy } from "@/lib/provider-errors"
import { useSharedModels } from "@/lib/shared-models"
import { captureBrowserEvent } from "@/lib/telemetry/browser"
import { TELEMETRY_EVENTS } from "@/lib/telemetry/events"
import { cn } from "@/lib/utils"
import { Link, useNavigate } from "@tanstack/react-router"
import {
    AlertTriangle,
    ChevronDown,
    CreditCard,
    ExternalLink,
    Hourglass,
    Key,
    Lock,
    Pencil,
    RotateCcw,
    ShieldAlert,
    Unplug
} from "lucide-react"
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { getProviderIcon } from "./model-selector"
import { SPOTLIGHT_CARD_CLASS } from "./renderers/spotlight-frame"
import { AnimatedCollapsible } from "./ui/animated-collapsible"
import { Button } from "./ui/button"

type ErrorCta = {
    label: string
    icon?: typeof AlertTriangle
    /** Navigate to a route. Mutually exclusive with {@link ErrorCta.action}. */
    to?: string
    /** Open an external page in a new tab, e.g. the provider's billing page. */
    href?: string
    /** Trigger an in-app action instead of navigating to a route. */
    action?: "new_chat"
}

type ErrorPresentation = {
    icon: typeof AlertTriangle
    title: string
    description?: string
    /** The provider's own wording, shown on BYOK where the user owns the account. */
    provider?: { name: string; statusCode?: number; message: string }
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

const PROVIDER_ERROR_ICON: Partial<Record<ProviderErrorCategory, typeof AlertTriangle>> = {
    insufficient_credits: CreditCard,
    invalid_key: Key,
    moderation: ShieldAlert,
    rate_limited: Hourglass,
    timeout: Hourglass,
    network: Unplug
}

const OPENROUTER_CREDITS_URL = "https://openrouter.ai/settings/credits"

const MANAGE_KEYS_CTA: ErrorCta = { label: "Manage keys", to: "/settings/providers", icon: Key }

/** Only BYOK errors point at the user's account; hosted ones are ours to fix. */
function getProviderErrorCtas(
    detail: ProviderErrorDetail
): Pick<ErrorPresentation, "primaryCta" | "secondaryCta"> {
    if (detail.category === "context_overflow") {
        return { primaryCta: { label: "New Chat", action: "new_chat", icon: Pencil } }
    }
    if (detail.keySource !== "byok") return {}

    if (detail.category === "insufficient_credits" && detail.providerName === "OpenRouter") {
        return {
            primaryCta: { label: "Add credits", href: OPENROUTER_CREDITS_URL, icon: ExternalLink },
            secondaryCta: MANAGE_KEYS_CTA
        }
    }
    if (
        detail.category === "insufficient_credits" ||
        detail.category === "invalid_key" ||
        detail.category === "network"
    ) {
        return { primaryCta: MANAGE_KEYS_CTA }
    }
    return {}
}

function describeProviderError(detail: ProviderErrorDetail): ErrorPresentation {
    const { title, description } = getProviderErrorCopy(detail)
    return {
        icon: PROVIDER_ERROR_ICON[detail.category] ?? AlertTriangle,
        title,
        description,
        provider: detail.providerMessage
            ? {
                  name: detail.providerName ?? "Provider",
                  statusCode: detail.statusCode,
                  message: detail.providerMessage
              }
            : undefined,
        ...getProviderErrorCtas(detail)
    }
}

/**
 * Translate a parsed chat error into a specific, actionable notice. Falls back
 * to the backend-supplied cause/message, then to a generic line.
 */
function describeChatError(parsed: ParsedChatError | null): ErrorPresentation {
    const detail = parsed?.detail

    if (detail?.kind === "provider_error") return describeProviderError(detail)

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
                description: "Edit your message, start a new chat, or switch to BYOK.",
                primaryCta: { label: "New Chat", action: "new_chat", icon: Pencil },
                secondaryCta: { label: "Set up BYOK", to: "/settings/providers", icon: Key },
                suggestedModels: detail.suggestedModels
            }
        }

        return {
            icon: AlertTriangle,
            title: "This thread is too long",
            description:
                "The selected model can't fit it. Edit your message, start a new chat, or pick a model that supports longer chats.",
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
        const parsedError = useMemo(() => parseChatError(error), [error])
        const presentation = useMemo(() => describeChatError(parsedError), [parsedError])
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

        useEffect(() => {
            const detail = parsedError?.detail
            if (detail?.kind !== "usage_limit_exceeded") return

            captureBrowserEvent(TELEMETRY_EVENTS.usageLimitEncountered, {
                window: detail.window,
                used_usd: detail.usedUsd ?? null,
                limit_usd: detail.limitUsd ?? null,
                remaining_usd: detail.remainingUsd ?? null
            })
        }, [parsedError])

        const renderCta = (cta: ErrorCta, variant: "default" | "outline") => {
            const CtaIcon = cta.icon
            // Filled buttons bring their own foreground; forcing one breaks contrast.
            const ctaClassName = variant === "outline" ? "text-foreground" : undefined
            if (cta.action === "new_chat") {
                return (
                    <Button
                        variant={variant}
                        size="sm"
                        className={ctaClassName}
                        onClick={startNewChat}
                    >
                        {CtaIcon && <CtaIcon />}
                        {cta.label}
                    </Button>
                )
            }
            if (cta.href) {
                return (
                    <Button asChild variant={variant} size="sm" className={ctaClassName}>
                        <a href={cta.href} target="_blank" rel="noreferrer">
                            {CtaIcon && <CtaIcon />}
                            {cta.label}
                        </a>
                    </Button>
                )
            }
            if (cta.to) {
                return (
                    <Button asChild variant={variant} size="sm" className={ctaClassName}>
                        <Link to={cta.to}>
                            {CtaIcon && <CtaIcon />}
                            {cta.label}
                        </Link>
                    </Button>
                )
            }
            return null
        }

        const suggestions =
            onSwitchModel && visibleSuggestions.length > 0
                ? visibleSuggestions.map((model) => {
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
                  })
                : null

        return (
            <div className={cn(SPOTLIGHT_CARD_CLASS, "p-5")}>
                <ErrorHeading icon={presentation.icon} title={presentation.title} />
                {presentation.description && (
                    <p className="mt-1 text-muted-foreground text-sm">{presentation.description}</p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    {presentation.primaryCta && renderCta(presentation.primaryCta, "default")}
                    {presentation.secondaryCta && renderCta(presentation.secondaryCta, "outline")}
                    {onRetry && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-foreground"
                            onClick={onRetry}
                        >
                            <RotateCcw />
                            Retry
                        </Button>
                    )}
                </div>
                {suggestions && (
                    <div className="mt-4 flex flex-col gap-2">
                        <span className="text-muted-foreground text-sm">Or continue with</span>
                        <div className="flex flex-wrap gap-2">{suggestions}</div>
                    </div>
                )}
                {presentation.provider && (
                    <ProviderDetails provider={presentation.provider} className="mt-4" />
                )}
            </div>
        )
    }
)

const URL_PATTERN = /(https?:\/\/[^\s]*[^\s.,;:!?)"'])/g

/** Upstream messages often embed URLs; make them clickable instead of a wall of text. */
function linkify(message: string) {
    return message.split(URL_PATTERN).map((segment, index) =>
        index % 2 === 1 ? (
            <a
                key={`${index}-${segment}`}
                href={segment}
                target="_blank"
                rel="noreferrer"
                className="break-all underline underline-offset-2 hover:text-foreground"
            >
                {segment}
            </a>
        ) : (
            segment
        )
    )
}

/** Lucide draws on a 24-unit grid with a 2-unit stroke. */
const LUCIDE_GRID = 24
const LUCIDE_STROKE = 2

/**
 * How far below the top of its line box an element's capitals start. The font's ascent and
 * cap height come from the browser, so this follows the real typeface and size.
 */
function measureCapTop(element: Element) {
    const style = getComputedStyle(element)
    const lineHeight = Number.parseFloat(style.lineHeight)
    const context = document.createElement("canvas").getContext("2d")
    if (!context || Number.isNaN(lineHeight)) return undefined
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const metrics = context.measureText("H")
    const halfLeading =
        (lineHeight - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2
    return halfLeading + metrics.fontBoundingBoxAscent - metrics.actualBoundingBoxAscent
}

/**
 * The title, led by an icon whose drawn top hangs from the title's cap height. Centring the
 * icon box on the line leaves it riding high beside ProximaVara's tall lowercase, and Lucide
 * pads each glyph differently inside its box, so the glyph's own bounds are used.
 */
function ErrorHeading({ icon: Icon, title }: { icon: ErrorPresentation["icon"]; title: string }) {
    const iconRef = useRef<SVGSVGElement>(null)
    const titleRef = useRef<HTMLHeadingElement>(null)
    const [iconTop, setIconTop] = useState<number>()

    // biome-ignore lint/correctness/useExhaustiveDependencies: a new glyph has new bounds to measure.
    useLayoutEffect(() => {
        let cancelled = false
        const align = () => {
            const icon = iconRef.current
            const heading = titleRef.current
            if (cancelled || !icon || !heading) return
            const capTop = measureCapTop(heading)
            if (capTop === undefined) return
            const scale = icon.getBoundingClientRect().height / LUCIDE_GRID
            const glyphTop = (icon.getBBox().y - LUCIDE_STROKE / 2) * scale
            setIconTop(capTop - glyphTop)
        }
        align()
        // The first pass can measure the fallback font; settle once ProximaVara loads.
        void document.fonts?.ready.then(align)
        return () => {
            cancelled = true
        }
    }, [Icon])

    return (
        <div className="flex items-start gap-2">
            <Icon
                ref={iconRef}
                className="size-4 shrink-0 text-destructive"
                style={{ marginTop: iconTop }}
            />
            <h3
                ref={titleRef}
                className="min-w-0 flex-1 font-semibold text-base leading-6 tracking-tight"
            >
                {title}
            </h3>
        </div>
    )
}

const HTTP_STATUS_TEXT: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    408: "Request Timeout",
    413: "Payload Too Large",
    422: "Unprocessable Content",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
    524: "Timeout Occurred"
}

/**
 * The provider's own account of the failure, folded away like the Details toggle on
 * code execution steps. Only BYOK errors carry it.
 */
function ProviderDetails({
    provider,
    className
}: {
    provider: NonNullable<ErrorPresentation["provider"]>
    className?: string
}) {
    const [open, setOpen] = useState(false)
    const statusText = provider.statusCode ? HTTP_STATUS_TEXT[provider.statusCode] : undefined

    return (
        <section className={className}>
            <button
                type="button"
                data-pause-chat-scroll-follow=""
                className="flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
                onClick={() => setOpen((shown) => !shown)}
                aria-expanded={open}
            >
                <ChevronDown
                    className={cn("size-3.5 transition-transform", open && "rotate-180")}
                />
                Details
            </button>
            <AnimatedCollapsible open={open}>
                <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
                    <dt className="text-muted-foreground">Provider</dt>
                    <dd className="text-foreground">{provider.name}</dd>
                    {provider.statusCode && (
                        <>
                            <dt className="text-muted-foreground">Status</dt>
                            <dd className="flex items-center gap-1.5 text-foreground">
                                <code className="rounded-[var(--radius-sm)] bg-destructive/10 px-1.5 py-0.5 font-mono text-destructive">
                                    {provider.statusCode}
                                </code>
                                {statusText}
                            </dd>
                        </>
                    )}
                    <dt className="text-muted-foreground">Response</dt>
                    <dd className="break-words text-foreground leading-relaxed">
                        {linkify(provider.message)}
                    </dd>
                </dl>
            </AnimatedCollapsible>
        </section>
    )
}

ChatErrorNotice.displayName = "ChatErrorNotice"
