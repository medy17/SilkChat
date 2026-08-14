const LARGE_PASTE_MEDIA_TYPE_PARAMETER = ";silkchat=large-paste"

export type AttachmentTileKind = "attachment" | "large-paste"

export const markLargePasteMediaType = (mediaType: string) =>
    mediaType.includes(LARGE_PASTE_MEDIA_TYPE_PARAMETER)
        ? mediaType
        : `${mediaType}${LARGE_PASTE_MEDIA_TYPE_PARAMETER}`

export const isLargePasteMediaType = (mediaType?: string) =>
    mediaType?.includes(LARGE_PASTE_MEDIA_TYPE_PARAMETER) ?? false

export const getAttachmentTileKind = (mediaType?: string): AttachmentTileKind =>
    isLargePasteMediaType(mediaType) ? "large-paste" : "attachment"

export const getAttachmentTileMediaType = (
    mediaType: string,
    kind: AttachmentTileKind = "attachment"
) => (kind === "large-paste" ? markLargePasteMediaType(mediaType) : mediaType)
