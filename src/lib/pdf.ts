import type { PDFDocumentLoadingTask } from "pdfjs-dist"

let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | undefined

export const loadPdfJs = () => {
    pdfJsPromise ??= Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url")
    ])
        .then(([pdfJs, workerModule]) => {
            pdfJs.GlobalWorkerOptions.workerSrc = workerModule.default
            return pdfJs
        })
        .catch((error) => {
            pdfJsPromise = undefined
            throw error
        })
    return pdfJsPromise
}

export const assertPdfPageLimit = async (file: File, maxPages: number) => {
    let loadingTask: PDFDocumentLoadingTask | undefined
    let pageCount: number

    try {
        const pdfJs = await loadPdfJs()
        loadingTask = pdfJs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
        const pdf = await loadingTask.promise
        pageCount = pdf.numPages
    } catch (error) {
        if (error instanceof Error && error.name === "PasswordException") {
            throw new Error(`${file.name}: Remove the PDF password before uploading`)
        }
        throw new Error(`${file.name}: Could not verify the PDF page count. Upload a readable PDF`)
    } finally {
        if (loadingTask) await loadingTask.destroy()
    }

    if (pageCount > maxPages) {
        throw new Error(
            `${file.name} has ${pageCount} pages. The maximum is ${maxPages}. Split the PDF and try again`
        )
    }
}
