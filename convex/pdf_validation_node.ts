"use node"

import { v } from "convex/values"
import { MAX_FILE_SIZE } from "@/lib/file_constants"
import { internalAction } from "./_generated/server"
import { readResponseBytesWithinLimit, validatePdfBytes } from "./lib/pdf_validation_node"
import { validateStoredPdf } from "./lib/stored_pdf_validation_node"

export const validateStored = internalAction({
    args: { storageKey: v.string(), fileName: v.string() },
    handler: (ctx, { storageKey, fileName }): Promise<number> =>
        validateStoredPdf(ctx, storageKey, fileName)
})

// Internal-only validation probe: downloads and checks a PDF, never stores it or calls a model.
export const validateRemotePdf = internalAction({
    args: { url: v.string(), fileName: v.string() },
    handler: async (_ctx, { url, fileName }) => {
        const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
        if (!response.ok) throw new Error(`Failed to download PDF (${response.status})`)
        const bytes = await readResponseBytesWithinLimit(response, MAX_FILE_SIZE)
        return validatePdfBytes(bytes, fileName)
    }
})
