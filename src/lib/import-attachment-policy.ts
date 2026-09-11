import { getFileTypeInfo, MAX_PDF_PAGES } from "./file_constants"

export const PDF_IMPORT_ERROR = `Conversations containing PDF attachments cannot be imported. Remove the PDF attachments from the export, then import again. You can upload PDFs of up to ${MAX_PDF_PAGES} pages afterward.`

export const isImportedPdf = (attachment: {
    filename?: string
    url?: string
    mimeType?: string
}) => {
    const mimeType = attachment.mimeType?.split(";")[0].trim().toLowerCase()
    if (getFileTypeInfo(attachment.filename ?? "", mimeType).isPdf) return true
    const url = attachment.url ?? ""
    if (/^data:application\/(?:x-)?pdf[;,]/i.test(url)) return true
    try {
        const parsed = new URL(url, "https://import.invalid")
        return [parsed.pathname, parsed.searchParams.get("key") ?? ""].some(
            (value) => getFileTypeInfo(decodeURIComponent(value)).isPdf
        )
    } catch {
        return getFileTypeInfo(url.split(/[?#]/)[0]).isPdf
    }
}
