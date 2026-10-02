import { AttachmentTile } from "@/components/attachment-tile"
import type { UploadedFile } from "@/lib/chat-store"
import { getFileTypeInfo } from "@/lib/file_constants"
import { getFileThumbnailSources } from "@/lib/generated-image-urls"
import { getPublicR2AssetUrl } from "@/lib/r2-public-url"
import { cn } from "@/lib/utils"
import { AttachmentAction, ShowAttachmentText } from "./attachment-actions"
import { AttachmentIcon } from "./attachment-icon"
import type { AttachmentPreview } from "./attachment-preview-dialog"

export function DraftAttachmentTile({
    file,
    content,
    onPreview,
    onRemove,
    onShowText,
    compact = false,
    disabled = false
}: {
    file: UploadedFile
    content?: string
    onPreview?: (preview: AttachmentPreview) => void
    onRemove: () => void
    onShowText?: () => void
    compact?: boolean
    disabled?: boolean
}) {
    const { isImage, isSvg } = getFileTypeInfo(file.fileName, file.fileType)
    const assetUrl = file.inlineDataUrl ?? getPublicR2AssetUrl(file.key)
    const previewUrl = isImage
        ? compact || isSvg
            ? assetUrl
            : (content ?? getFileThumbnailSources(file.key).src)
        : undefined

    return (
        <div className="group relative shrink-0">
            <AttachmentTile
                fileName={file.displayName ?? file.fileName}
                kind={file.tileKind}
                icon={
                    <AttachmentIcon
                        fileName={file.fileName}
                        fileType={file.fileType}
                        kind={file.tileKind}
                    />
                }
                previewUrl={previewUrl}
                onClick={
                    onPreview
                        ? () =>
                              onPreview({
                                  content,
                                  fileName: file.fileName,
                                  fileType: file.fileType,
                                  url: assetUrl
                              })
                        : undefined
                }
                secondaryAction={
                    file.source === "pasted-text" && onShowText ? (
                        <ShowAttachmentText onClick={onShowText} disabled={disabled} />
                    ) : undefined
                }
                className={cn(compact ? "h-12" : !previewUrl && "w-auto min-w-[5rem]")}
            />
            <AttachmentAction label="Remove attachment" onClick={onRemove} disabled={disabled} />
        </div>
    )
}
