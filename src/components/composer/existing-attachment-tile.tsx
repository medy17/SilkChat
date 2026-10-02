import { AttachmentTile } from "@/components/attachment-tile"
import { getAttachmentTileKind } from "@/lib/attachment-tile"
import { getFileTypeInfo } from "@/lib/file_constants"
import { resolvePublicFileUrl } from "@/lib/r2-public-url"
import { cn } from "@/lib/utils"
import type { FileUIPart } from "ai"
import { Trash2 } from "lucide-react"
import { AttachmentAction } from "./attachment-actions"
import { AttachmentIcon } from "./attachment-icon"

const extractFileName = (url: string) => {
    if (url.startsWith("data:")) return "Inline file"
    const match = url.match(/[?&]key=([^&]+)/)
    const key = match?.[1] ? decodeURIComponent(match[1]) : url
    const extracted = key.split("/").pop() ?? ""
    return extracted.length > 51 ? extracted.slice(51) : extracted
}

export function ExistingAttachmentTile({
    part,
    removed,
    compact,
    disabled = false,
    onToggleRemove
}: {
    part: FileUIPart
    removed: boolean
    compact: boolean
    disabled?: boolean
    onToggleRemove: () => void
}) {
    const fileName = part.filename || extractFileName(part.url)
    const { isImage } = getFileTypeInfo(fileName, part.mediaType)
    const kind = getAttachmentTileKind(part.mediaType)

    return (
        <div className="group relative min-w-0 max-w-full shrink-0">
            {isImage ? (
                <div
                    className={cn(
                        "flex items-center justify-center overflow-hidden border-2 border-border bg-secondary/50",
                        compact ? "h-12 w-12" : "h-auto max-h-64 w-auto max-w-full",
                        removed && "opacity-50 grayscale-[50%]"
                    )}
                    style={{ borderRadius: "var(--radius)" }}
                >
                    <img
                        src={resolvePublicFileUrl(part.url)}
                        alt={fileName}
                        className={cn(
                            "object-cover",
                            compact ? "h-full w-full" : "h-auto max-h-64 w-auto max-w-full"
                        )}
                        style={{ borderRadius: "calc(var(--radius) - 2px)" }}
                    />
                </div>
            ) : (
                <AttachmentTile
                    fileName={fileName}
                    kind={kind}
                    icon={
                        <AttachmentIcon fileName={fileName} fileType={part.mediaType} kind={kind} />
                    }
                    className={cn("h-12", removed && "opacity-50 grayscale-[50%]")}
                />
            )}
            {removed && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
                    <Trash2 className="size-5 text-destructive drop-shadow-md" />
                </div>
            )}
            <AttachmentAction
                label={removed ? "Restore attachment" : "Remove attachment from message"}
                restore={removed}
                disabled={disabled}
                onClick={onToggleRemove}
            />
        </div>
    )
}
