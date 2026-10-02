import { afterEach, expect, it, vi } from "vitest"
import {
    ATTACHMENT_ONLY_TEXT,
    resolveComposerText,
    readPastedAttachment
} from "@/lib/composer-message"
import { prepareComposerMessage } from "@/lib/composer-message"
import { DEFAULT_UPLOAD_POLICY } from "@/lib/file_constants"
afterEach(() => vi.unstubAllGlobals())
it.each(["", " \t\r\n", "\u00a0\u2003"])(
    "uses the attachment-only explanation for whitespace %j",
    (text) => {
        expect(resolveComposerText(text, 1)).toBe(ATTACHMENT_ONLY_TEXT)
        expect(resolveComposerText(text, 0)).toBeNull()
    }
)
it.each(["42", "!@#$", "Hello"])("accepts non-whitespace text %s", (text) => {
    expect(resolveComposerText(`\n${text} `, 0)).toBe(text)
})
it("reloads restored pasted text on demand and rejects failed retrieval", async () => {
    const file = {
        key: "paste",
        fileName: "Pasted Text 1.txt",
        fileType: "text/plain",
        fileSize: 10,
        uploadedAt: 1,
        inlineDataUrl: "data:text/plain,hello"
    }
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(new Response("restored text"))
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
    vi.stubGlobal("fetch", fetch)
    await expect(readPastedAttachment(file)).resolves.toBe("restored text")
    await expect(readPastedAttachment(file)).rejects.toThrow("Try again")
    expect(file).not.toHaveProperty("largePasteContent")
})

it("validates the final edited attachment set and normalizes attachment-only messages", () => {
    const input = {
        text: " \n",
        existingParts: [
            {
                type: "file" as const,
                url: "https://example.com/image.png",
                filename: "image.png",
                mediaType: "image/png"
            }
        ],
        attachments: [
            {
                key: "inline",
                fileName: "notes.txt",
                fileType: "text/plain",
                fileSize: 20,
                uploadedAt: 1,
                inlineDataUrl: "data:text/plain,notes"
            }
        ],
        support: { supportsVision: false, supportsNativePdf: false },
        policy: DEFAULT_UPLOAD_POLICY
    }
    expect(prepareComposerMessage(input).errors).toEqual([
        "image.png: Current model doesn't support image files"
    ])
    const prepared = prepareComposerMessage({ ...input, deletedUrls: [input.existingParts[0].url] })
    expect(prepared).toMatchObject({ text: ATTACHMENT_ONLY_TEXT, errors: [] })
    expect(prepared.fileParts).toEqual([
        {
            type: "file",
            url: "data:text/plain,notes",
            mediaType: "text/plain",
            filename: "notes.txt"
        }
    ])
    expect(
        prepareComposerMessage({
            ...input,
            attachments: [
                { ...input.attachments[0], fileSize: DEFAULT_UPLOAD_POLICY.maxFileSize + 1 }
            ],
            existingParts: []
        }).errors[0]
    ).toContain("File size exceeds")
})
