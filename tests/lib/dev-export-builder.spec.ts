import { describe, expect, it } from "vitest"
import {
    type ExportDraft,
    type DraftMessage,
    buildDraftExport,
    draftFromParsedDocument,
    findRepeatedRoleMessageIds
} from "@/lib/dev-export-builder"
import { parseThreadImportContent } from "@/lib/thread-import-core"

describe("dev export builder", () => {
    it("builds a draft that the importer reads back as written", () => {
        const draft: ExportDraft = {
            title: "Fog notes",
            threadId: "dev-fog",
            createdAt: "2026-11-01T09:30",
            updatedAt: "2026-11-01T10:00",
            personaId: "blue",
            messages: [
                {
                    id: "b",
                    role: "user",
                    text: "What is this?",
                    modelName: "",
                    attachments: [
                        { id: "x", url: "https://example.com/fog.png", filename: "fog.png" }
                    ]
                },
                { id: "c", role: "assistant", text: "Fog.", modelName: "GPT-5", attachments: [] }
            ]
        }

        const { markdown } = buildDraftExport({ draft, convexApiUrl: "https://convex.test" })
        const parsed = parseThreadImportContent({ content: markdown, fileName: "fog.md" })
        const { messages, ...metadata } = draftFromParsedDocument(parsed)

        expect(metadata).toEqual({
            title: draft.title,
            threadId: draft.threadId,
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt,
            personaId: draft.personaId
        })
        expect(
            messages.map(({ role, text, modelName, attachments }) => ({
                role,
                text,
                modelName,
                attachments: attachments.map(({ url, filename }) => ({ url, filename }))
            }))
        ).toEqual(
            draft.messages.map(({ role, text, modelName, attachments }) => ({
                role,
                text,
                modelName,
                attachments: attachments.map(({ url, filename }) => ({ url, filename }))
            }))
        )
    })

    it("flags back-to-back roles, ignoring empty messages", () => {
        const message = (id: string, role: DraftMessage["role"], text = "hi"): DraftMessage => ({
            id,
            role,
            text,
            modelName: "",
            attachments: []
        })

        const repeated = findRepeatedRoleMessageIds([
            message("opening", "assistant"),
            message("q1", "user"),
            message("a1", "assistant"),
            message("blank", "user", " "),
            message("a2", "assistant"),
            message("q2", "user")
        ])

        expect([...repeated]).toEqual(["a2"])
    })
})
