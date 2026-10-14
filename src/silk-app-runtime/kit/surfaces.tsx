import { SPOTLIGHT_CARD_CLASS } from "@/components/renderers/spotlight-frame"
import { cn } from "@/lib/utils"
import { CircleAlert, CircleCheck, Info, OctagonAlert } from "lucide-react"
import {
    type ComponentProps,
    type ComponentType,
    type ReactElement,
    type ReactNode,
    isValidElement
} from "react"

export type Tone = "neutral" | "info" | "success" | "warning" | "critical"

export const TONE_TEXT: Record<Tone, string> = {
    neutral: "text-foreground",
    info: "text-info",
    success: "text-success",
    warning: "text-warning",
    critical: "text-destructive"
}

const TONE_TINT: Record<Tone, string> = {
    neutral: "bg-muted text-muted-foreground",
    info: "bg-info/12 text-info",
    success: "bg-success/12 text-success",
    warning: "bg-warning/12 text-warning",
    critical: "bg-destructive/12 text-destructive"
}

// Cards follow the Spotlight surface; shadcn's sub-component API is kept because
// models already write it fluently.
export function Card({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card"
            className={cn("flex min-w-0 flex-col gap-4 py-5", SPOTLIGHT_CARD_CLASS, className)}
            {...props}
        />
    )
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-header"
            className={cn(
                "grid auto-rows-min items-start gap-1 px-5 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
                className
            )}
            {...props}
        />
    )
}

export function CardTitle({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-title"
            className={cn("font-semibold text-base leading-snug tracking-tight", className)}
            {...props}
        />
    )
}

export function CardDescription({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-description"
            className={cn("text-muted-foreground text-sm", className)}
            {...props}
        />
    )
}

export function CardAction({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-action"
            className={cn(
                "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
                className
            )}
            {...props}
        />
    )
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
    return <div data-slot="card-content" className={cn("px-5", className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-footer"
            className={cn("flex items-center gap-2 px-5", className)}
            {...props}
        />
    )
}

export function Tag({
    tone = "info",
    className,
    ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono text-xs",
                TONE_TINT[tone],
                className
            )}
            {...props}
        />
    )
}

/** The title card that opens an app. */
export function AppHeader({
    title,
    description,
    tags,
    actions,
    className
}: {
    title: ReactNode
    description?: ReactNode
    tags?: ReactNode[]
    actions?: ReactNode
    className?: string
}) {
    return (
        <Card className={cn("gap-0", className)}>
            {/* Wide actions wrap under the title rather than squeezing it. */}
            <div className="flex flex-wrap items-start gap-3 px-5">
                <div className="min-w-[min(100%,16rem)] flex-1">
                    <h2 className="text-balance font-semibold text-xl leading-tight tracking-tight">
                        {title}
                    </h2>
                    {tags && tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {tags.map((tag, index) =>
                                typeof tag === "string" ? (
                                    <Tag key={`${tag}-${index}`}>{tag}</Tag>
                                ) : (
                                    tag
                                )
                            )}
                        </div>
                    )}
                    {description && (
                        <p className="mt-2 text-pretty text-muted-foreground text-sm">
                            {description}
                        </p>
                    )}
                </div>
                {actions && (
                    <div className="flex min-w-0 max-w-full items-center gap-2">{actions}</div>
                )}
            </div>
        </Card>
    )
}

const ALERT_TONES: Record<
    Tone,
    {
        box: string
        title: string
        body: string
        badge: string
        icon: ComponentType<{ className?: string }>
    }
> = {
    neutral: {
        box: "border-border bg-card",
        title: "text-foreground",
        body: "text-muted-foreground",
        badge: "bg-muted text-muted-foreground",
        icon: Info
    },
    info: {
        box: "border-info/35 bg-info/10",
        title: "text-info",
        body: "text-foreground/80",
        badge: "bg-info text-background",
        icon: Info
    },
    success: {
        box: "border-success/35 bg-success/10",
        title: "text-success",
        body: "text-foreground/80",
        badge: "bg-success text-background",
        icon: CircleCheck
    },
    warning: {
        box: "border-warning/40 bg-warning/10",
        title: "text-warning",
        body: "text-foreground/80",
        badge: "bg-warning text-warning-foreground",
        icon: CircleAlert
    },
    critical: {
        box: "border-destructive/50 bg-destructive/12",
        title: "text-destructive",
        body: "text-destructive/85",
        badge: "bg-destructive text-destructive-foreground",
        icon: OctagonAlert
    }
}

export function Alert({
    tone = "neutral",
    variant,
    title,
    badge,
    icon,
    children,
    className,
    ...props
}: Omit<ComponentProps<"div">, "title"> & {
    tone?: Tone
    /** shadcn compatibility: "destructive" reads as the critical tone. */
    variant?: "default" | "destructive"
    title?: ReactNode
    badge?: ReactNode
    /** An icon component, or an element such as `<AlertTriangle />`; false hides it. */
    icon?: ComponentType<{ className?: string }> | ReactElement | false
}) {
    const resolvedTone = variant === "destructive" ? "critical" : tone
    const style = ALERT_TONES[resolvedTone]
    const iconClass = cn("mt-0.5 size-4 shrink-0", style.title)
    const Icon = icon === false || isValidElement(icon) ? null : (icon ?? style.icon)
    const urgent = resolvedTone === "critical" || resolvedTone === "warning"

    return (
        // Keyed on tone so a change of severity replays the entrance.
        <div
            key={resolvedTone}
            role="alert"
            className={cn(
                "fade-in-0 slide-in-from-top-1 flex animate-in items-start gap-3 rounded-[var(--radius-lg)] border px-4 py-3 duration-300",
                style.box,
                className
            )}
            {...props}
        >
            {isValidElement(icon) ? (
                <span className={cn("flex [&_svg]:size-4", iconClass)}>{icon}</span>
            ) : (
                Icon && <Icon className={iconClass} />
            )}
            <div className="min-w-0 flex-1">
                {title && <p className={cn("font-semibold text-sm", style.title)}>{title}</p>}
                {children && (
                    <div className={cn("text-sm [&_p]:leading-relaxed", style.body)}>
                        {children}
                    </div>
                )}
            </div>
            {badge && (
                <span
                    className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono font-semibold text-[11px] uppercase tracking-wide",
                        style.badge
                    )}
                >
                    {urgent && (
                        <span aria-hidden className="relative flex size-1.5">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-70" />
                            <span className="relative inline-flex size-1.5 rounded-full bg-current" />
                        </span>
                    )}
                    {badge}
                </span>
            )}
        </div>
    )
}

export function AlertTitle({ className, ...props }: ComponentProps<"p">) {
    return <p className={cn("font-semibold text-sm", className)} {...props} />
}

export function AlertDescription({ className, ...props }: ComponentProps<"div">) {
    return <div className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
}
