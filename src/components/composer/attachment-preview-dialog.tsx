import { TabularFilePreview } from "@/components/tabular-file-preview"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getFileTypeInfo } from "@/lib/file_constants"
import {
    TEXT_PREVIEW_MAX_CHARS,
    TEXT_PREVIEW_MAX_LINES,
    isTabularTextFile,
    truncateTextPreview
} from "@/lib/tabular-file-preview"
import { FileType } from "lucide-react"
import { AttachmentIcon } from "./attachment-icon"

export type AttachmentPreview = {
    content?: string
    fileName: string
    fileType: string
    url: string
}

function AttachmentPreviewContent({ file }: { file: AttachmentPreview }) {
    const { isImage, isText } = getFileTypeInfo(file.fileName, file.fileType)
    if (isImage)
        return (
            <img
                src={file.content ?? file.url}
                alt={file.fileName}
                className="h-auto w-full rounded-[var(--radius-md)] object-contain"
            />
        )
    if (isTabularTextFile(file.fileName, file.fileType))
        return (
            <TabularFilePreview
                url={file.url}
                content={file.content}
                filename={file.fileName}
                mediaType={file.fileType}
            />
        )
    if (isText) {
        if (file.content === undefined)
            return (
                <iframe
                    src={file.url}
                    className="h-[69dvh] w-full rounded-[var(--radius-md)] border-0"
                    title={file.fileName}
                />
            )
        const preview = truncateTextPreview(file.content)
        return (
            <div className="space-y-2">
                {preview.truncated && (
                    <p className="text-muted-foreground text-xs">
                        Preview limited to {TEXT_PREVIEW_MAX_LINES} lines or{" "}
                        {TEXT_PREVIEW_MAX_CHARS.toLocaleString()} characters. Download the file for
                        the complete content.
                    </p>
                )}
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] bg-muted p-4 text-sm">
                    {preview.content}
                </pre>
            </div>
        )
    }
    return (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
            <div className="text-center">
                <FileType className="mx-auto mb-2 size-12" />
                <p>Binary file: {file.fileName}</p>
                <p className="mt-1 text-xs">Preview not available</p>
            </div>
        </div>
    )
}

export function AttachmentPreviewDialog({
    file,
    open,
    onOpenChange
}: {
    file: AttachmentPreview | null
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="md:!max-w-[min(90vw,60rem)] max-h-[90dvh] max-w-full">
                {file && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <AttachmentIcon fileName={file.fileName} fileType={file.fileType} />
                                {file.fileName}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="max-h-[70dvh] w-full overflow-auto">
                            <AttachmentPreviewContent file={file} />
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
