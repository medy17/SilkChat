import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { RotateCcw, X } from "lucide-react"

export function AttachmentAction({
    label,
    onClick,
    restore = false,
    disabled = false
}: {
    label: string
    onClick: () => void
    restore?: boolean
    disabled?: boolean
}) {
    const Icon = restore ? RotateCcw : X
    return (
        <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    disabled={disabled}
                    onClick={(event) => {
                        event.stopPropagation()
                        onClick()
                    }}
                    aria-label={label}
                    className={cn(
                        "absolute -top-2 -right-2 h-8 w-8 text-foreground opacity-100 shadow-sm transition-opacity md:-top-1 md:-right-1 md:h-5 md:w-5 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
                        restore
                            ? "bg-background/80"
                            : "bg-background/50 hover:bg-destructive hover:text-destructive-foreground"
                    )}
                    style={{ borderRadius: "var(--radius-xl)" }}
                >
                    <Icon className="size-4 md:size-3" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
                <p>{label}</p>
            </TooltipContent>
        </Tooltip>
    )
}

export function ShowAttachmentText({
    onClick,
    disabled = false
}: {
    onClick: () => void
    disabled?: boolean
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="max-w-full truncate text-left text-primary text-xs hover:underline"
        >
            Show as text
        </button>
    )
}
