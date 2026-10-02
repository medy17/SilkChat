import type { AttachmentTileKind } from "@/lib/attachment-tile"
import { getFileTypeInfo } from "@/lib/file_constants"
import { Code, FileText, FileType, FileType2, Image as ImageIcon } from "lucide-react"

export function AttachmentIcon({
    fileName,
    fileType,
    kind = "attachment"
}: {
    fileName: string
    fileType?: string
    kind?: AttachmentTileKind
}) {
    if (kind === "large-paste") return <FileText className="size-4 text-primary" />
    const { isImage, isCode, isPdf } = getFileTypeInfo(fileName, fileType)
    if (isImage) return <ImageIcon className="size-4 text-primary" />
    if (isCode) return <Code className="size-4 text-primary" />
    if (isPdf) return <FileType2 className="size-4 text-muted-foreground" />
    return <FileType className="size-4 text-muted-foreground" />
}
