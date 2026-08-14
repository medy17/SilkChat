const INLINE_DOCUMENT_DATA_URL_PREFIX = "data:text/markdown;charset=utf-8,"
const CLIENT_DOCUMENT_MARKER = 'converted-by="anydoc-wasm"'

const decodeTagAttribute = (value: string) =>
    value
        .replaceAll("&quot;", '"')
        .replaceAll("&gt;", ">")
        .replaceAll("&lt;", "<")
        .replaceAll("&amp;", "&")

export const createInlineDocumentDataUrl = (content: string) =>
    `${INLINE_DOCUMENT_DATA_URL_PREFIX}${encodeURIComponent(content)}`

export const decodeInlineDocumentDataUrl = (dataUrl: string) => {
    if (!dataUrl.startsWith(INLINE_DOCUMENT_DATA_URL_PREFIX)) return null

    try {
        const content = decodeURIComponent(dataUrl.slice(INLINE_DOCUMENT_DATA_URL_PREFIX.length))
        return content.includes(CLIENT_DOCUMENT_MARKER) ? content : null
    } catch {
        return null
    }
}

export const getClientDocumentContextMetadata = (content: string) => {
    if (!content.startsWith("<file ") || !content.includes(CLIENT_DOCUMENT_MARKER)) return null

    const openingTag = content.slice(0, content.indexOf(">") + 1)
    const name = openingTag.match(/\bname="([^"]*)"/)?.[1]
    if (!name) return null

    return {
        fileName: decodeTagAttribute(name),
        sourceSizeBytes: Number(openingTag.match(/\bsource-size-bytes="(\d+)"/)?.[1] ?? 0)
    }
}
