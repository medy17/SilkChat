import type { AttachmentTileKind } from "@/lib/attachment-tile"
import { cn } from "@/lib/utils"
import { Check, FileText, FileType } from "lucide-react"
import type { ReactNode } from "react"

export type AttachmentTileStatus = "ready" | "uploading" | "success" | "error"

export const AttachmentTile = ({
    fileName,
    kind = "attachment",
    detail,
    icon,
    onClick,
    className,
    status = "ready",
    progress = 0,
    error,
    previewUrl,
    secondaryAction,
    disabled = false
}: {
    fileName: string
    kind?: AttachmentTileKind
    detail?: ReactNode
    icon?: ReactNode
    onClick?: () => void
    className?: string
    status?: AttachmentTileStatus
    progress?: number
    error?: string
    previewUrl?: string
    secondaryAction?: ReactNode
    disabled?: boolean
}) => {
    const normalizedProgress = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0
    const statusDetail = status === "error" ? error || "Upload failed" : detail

    const textContent = (
        <>
            <span className="shrink-0">
                {icon ??
                    (kind === "large-paste" ? (
                        <FileText className="size-4 text-primary" />
                    ) : (
                        <FileType className="size-4 text-muted-foreground" />
                    ))}
            </span>
            <span className="flex min-w-0 flex-col items-start">
                <span className="max-w-[9.5rem] truncate font-medium text-sm">{fileName}</span>
                {statusDetail && (
                    <span
                        className={cn(
                            "flex max-w-[9.5rem] items-center gap-1 truncate text-muted-foreground text-xs",
                            status === "error" && "text-destructive"
                        )}
                    >
                        {statusDetail}
                    </span>
                )}
            </span>
        </>
    )

    const content = previewUrl ? (
        <>
            <img
                src={previewUrl}
                alt=""
                className={cn(
                    "h-full w-full object-cover transition-all",
                    status === "uploading" && "opacity-40 blur-[2px]"
                )}
                style={{ borderRadius: "calc(var(--radius) - 2px)" }}
            />
        </>
    ) : (
        textContent
    )

    const classes = cn(
        "relative min-h-12 min-w-0 max-w-52 overflow-hidden border-2 border-border bg-secondary/50 text-left transition-colors",
        onClick && "cursor-pointer hover:bg-secondary/80",
        disabled && "cursor-not-allowed opacity-50 hover:bg-secondary/50",
        previewUrl && "size-12",
        status === "error" && "border-destructive/50",
        className
    )

    const mainClasses = cn(
        "flex min-h-12 w-full min-w-0 items-center gap-2 px-3 text-left outline-none",
        previewUrl && "h-full p-0",
        status === "uploading" && !previewUrl && "opacity-40 blur-[2px]"
    )
    const mainContent = onClick ? (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={fileName}
            className={mainClasses}
        >
            {content}
        </button>
    ) : (
        <div title={fileName} className={mainClasses}>
            {content}
        </div>
    )

    return (
        <div className={classes} style={{ borderRadius: "var(--radius)" }}>
            {mainContent}
            {status === "uploading" && (
                <div
                    className={cn(
                        "absolute inset-x-0 top-0 z-10 flex min-h-12 flex-col items-center justify-center gap-1",
                        previewUrl ? "bg-black/20 text-white" : "bg-background/50 text-foreground"
                    )}
                >
                    <span
                        className={cn(
                            "font-semibold text-[0.625rem] leading-none",
                            previewUrl && "drop-shadow-md"
                        )}
                    >
                        {Math.round(normalizedProgress)}%
                    </span>
                    <span
                        className={cn(
                            "h-1 overflow-hidden",
                            previewUrl ? "w-8" : "w-[calc(100%-1.5rem)]",
                            previewUrl ? "bg-white/30" : "bg-border"
                        )}
                        style={{ borderRadius: "var(--radius)" }}
                    >
                        <span
                            className={cn(
                                "block h-full transition-all duration-200",
                                previewUrl ? "bg-white" : "bg-primary"
                            )}
                            style={{ width: `${normalizedProgress}%` }}
                        />
                    </span>
                </div>
            )}
            {status === "success" && (
                <div className="absolute inset-x-0 top-0 z-10 flex min-h-12 items-center justify-center bg-black/20">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary/90 text-primary-foreground">
                        <Check className="size-3" />
                    </span>
                </div>
            )}
            {secondaryAction && !previewUrl && (
                <div className="-mt-1 pb-1 pl-9">{secondaryAction}</div>
            )}
        </div>
    )
}
