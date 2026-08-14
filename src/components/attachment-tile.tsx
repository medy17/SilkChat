import type { AttachmentTileKind } from "@/lib/attachment-tile"
import { cn } from "@/lib/utils"
import { Check, CircleAlert, FileText, FileType } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
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
        <img
            src={previewUrl}
            alt=""
            className="h-full w-full object-cover"
            style={{ borderRadius: "calc(var(--radius) - 2px)" }}
        />
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
        previewUrl && "h-full p-0"
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
            <AnimatePresence mode="wait">
                {status === "uploading" || status === "success" ? (
                    <motion.div
                        key="upload"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/80 text-foreground backdrop-blur-sm"
                    >
                        <div className="relative flex h-8 w-full items-center justify-center">
                            <div
                                className={cn(
                                    "absolute inset-x-0 flex flex-col items-center justify-center gap-1 transition-all duration-200 ease-out",
                                    status === "success"
                                        ? "scale-95 opacity-0"
                                        : "scale-100 opacity-100"
                                )}
                            >
                                <span className="font-semibold text-[0.625rem] leading-none">
                                    {Math.round(normalizedProgress)}%
                                </span>
                                <span
                                    className={cn(
                                        "h-1 overflow-hidden bg-foreground/30",
                                        previewUrl ? "w-8" : "w-[calc(100%-1.5rem)]"
                                    )}
                                    style={{ borderRadius: "var(--radius)" }}
                                >
                                    <motion.span
                                        className="block h-full bg-foreground"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${normalizedProgress}%` }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                        style={{ borderRadius: "var(--radius)" }}
                                    />
                                </span>
                            </div>
                            <Check
                                className={cn(
                                    "absolute size-5 transition-all duration-200 ease-out",
                                    status === "success"
                                        ? "scale-100 opacity-100"
                                        : "scale-95 opacity-0"
                                )}
                                aria-hidden="true"
                            />
                        </div>
                    </motion.div>
                ) : status === "error" ? (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 flex items-center justify-center bg-background/85 backdrop-blur-sm"
                    >
                        <span className="flex max-w-[90%] items-center gap-1 bg-destructive/10 px-2 py-1 font-medium text-destructive text-xs">
                            <CircleAlert className="size-3 shrink-0" />
                            <span className={cn("truncate", previewUrl && "sr-only")}>
                                Upload failed
                            </span>
                        </span>
                    </motion.div>
                ) : null}
            </AnimatePresence>
            {secondaryAction && !previewUrl && (
                <div className="-mt-1 pb-1 pl-9">{secondaryAction}</div>
            )}
        </div>
    )
}
