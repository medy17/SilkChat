import { AttachmentTile } from "@/components/attachment-tile"
import type { AttachmentJob } from "@/lib/composer-session"
import { cn } from "@/lib/utils"
import { AttachmentAction, ShowAttachmentText } from "./attachment-actions"
import { AttachmentIcon } from "./attachment-icon"

export function UploadingAttachmentTile({
    job,
    onCancel,
    onShowText,
    compact = false,
    disabled = false
}: {
    job: AttachmentJob
    onCancel?: () => void
    onShowText?: () => void
    compact?: boolean
    disabled?: boolean
}) {
    return (
        <div className="group relative shrink-0">
            <AttachmentTile
                fileName={job.displayName}
                kind={job.tileKind}
                icon={
                    <AttachmentIcon
                        fileName={job.file.name}
                        fileType={job.file.type}
                        kind={job.tileKind}
                    />
                }
                status={job.status === "preparing" ? "uploading" : job.status}
                progress={job.progress}
                error={job.error}
                previewUrl={job.previewUrl}
                secondaryAction={
                    job.source === "pasted-text" && job.content && onShowText ? (
                        <ShowAttachmentText onClick={onShowText} disabled={disabled} />
                    ) : undefined
                }
                className={cn(!job.previewUrl && (compact ? "h-12" : "w-auto min-w-[5rem]"))}
            />
            {onCancel && (
                <AttachmentAction
                    label={job.status === "error" ? "Remove failed upload" : "Cancel upload"}
                    onClick={onCancel}
                    disabled={disabled}
                />
            )}
        </div>
    )
}
