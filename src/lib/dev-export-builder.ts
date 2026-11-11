import { compilePersonaSnapshot } from "@/convex/lib/personas"
import { getBuiltInPersonaById } from "@/lib/personas/builtins"
import {
    type ExportableMessage,
    type ExportableThread,
    serializeThreadToMarkdown
} from "@/lib/thread-export"
import type { ParsedThreadImportDocument } from "@/lib/thread-import"
import { nanoid } from "nanoid"
import { create } from "zustand"
import { persist } from "zustand/middleware"

// Dev-only: fake a conversation and run it through the real markdown exporter, so the
// importer gets exactly what a genuine export would give it.

// SilkChat never stores system messages (the system prompt is rebuilt per request), so
// a draft only has the two roles a real export can contain.
export type DraftRole = "user" | "assistant"

export type DraftAttachment = {
    id: string
    // An https URL, or an R2 key such as `attachments/<user>/<file>`.
    url: string
    filename: string
}

export type DraftMessage = {
    id: string
    role: DraftRole
    text: string
    modelName: string
    attachments: DraftAttachment[]
}

export type ExportDraft = {
    title: string
    threadId: string
    // `datetime-local` values, read in the browser's time zone.
    createdAt: string
    updatedAt: string
    // A built-in Persona id, or "" for none.
    personaId: string
    messages: DraftMessage[]
}

const pad = (value: number) => `${value}`.padStart(2, "0")

export const toDateTimeLocal = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const fromDateTimeLocal = (value: string, fallback: number) => {
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : fallback
}

export const createDraftMessage = (role: DraftRole, modelName = ""): DraftMessage => ({
    id: nanoid(),
    role,
    text: "",
    modelName: role === "assistant" ? modelName : "",
    attachments: []
})

export const createDraftAttachment = (): DraftAttachment => ({
    id: nanoid(),
    url: "",
    filename: ""
})

export const createExportDraft = (now = Date.now()): ExportDraft => ({
    title: "Imported Chat",
    threadId: `dev-${nanoid(10)}`,
    createdAt: toDateTimeLocal(now - 60 * 60 * 1000),
    updatedAt: toDateTimeLocal(now),
    personaId: "",
    messages: [createDraftMessage("user"), createDraftMessage("assistant")]
})

const buildPersonaSnapshot = (personaId: string) => {
    const persona = personaId ? getBuiltInPersonaById(personaId) : null
    if (!persona) return undefined
    return compilePersonaSnapshot({
        source: "builtin",
        sourceId: persona.id,
        name: persona.name,
        shortName: persona.shortName,
        description: persona.description,
        instructions: persona.instructions,
        defaultModelId: persona.defaultModelId,
        conversationStarters: persona.conversationStarters,
        roleplayFormat: persona.roleplayFormat,
        avatarKind: "builtin",
        avatarValue: persona.avatarPath,
        knowledgeDocs: persona.knowledgeDocs
    })
}

export const buildDraftExport = ({
    draft,
    convexApiUrl,
    publicAssetBaseUrl,
    exportedAt = Date.now()
}: {
    draft: ExportDraft
    convexApiUrl: string
    publicAssetBaseUrl?: string
    exportedAt?: number
}) => {
    const createdAt = fromDateTimeLocal(draft.createdAt, exportedAt)
    const updatedAt = Math.max(createdAt, fromDateTimeLocal(draft.updatedAt, createdAt))
    const thread: ExportableThread = {
        _id: draft.threadId.trim() || "dev-export",
        title: draft.title,
        createdAt,
        updatedAt,
        personaSnapshot: buildPersonaSnapshot(draft.personaId)
    }

    // The exporter sorts by createdAt, so the draft's order becomes the timeline.
    const messages: ExportableMessage[] = draft.messages.map((message, index) => ({
        messageId: message.id,
        role: message.role,
        createdAt: createdAt + index,
        updatedAt: createdAt + index,
        parts: [
            { type: "text" as const, text: message.text },
            ...message.attachments
                .filter((attachment) => attachment.url.trim())
                .map((attachment) => ({
                    type: "file" as const,
                    data: attachment.url.trim(),
                    filename: attachment.filename.trim() || undefined
                }))
        ],
        metadata:
            message.role === "assistant" && message.modelName.trim()
                ? { modelName: message.modelName.trim() }
                : undefined
    }))

    return serializeThreadToMarkdown({
        thread,
        messages,
        convexApiUrl,
        publicAssetBaseUrl,
        exportedAt
    })
}

const hasContent = (message: DraftMessage) =>
    Boolean(message.text.trim()) || message.attachments.some((attachment) => attachment.url.trim())

// Ids of messages with the same role as the previous user/assistant message, which usually
// means a role was picked by mistake. Empty messages are dropped on import, so they don't count.
export const findRepeatedRoleMessageIds = (messages: DraftMessage[]) => {
    const repeated = new Set<string>()
    let previousRole: DraftRole | undefined
    for (const message of messages) {
        if (!hasContent(message)) continue
        if (message.role === previousRole) repeated.add(message.id)
        previousRole = message.role
    }
    return repeated
}

// Loads an existing export back into the builder so it can be edited.
export const draftFromParsedDocument = (document: ParsedThreadImportDocument): ExportDraft => {
    const now = Date.now()
    const createdAt = document.source.createdAt ?? now
    const persona =
        document.personaSnapshot?.source === "builtin"
            ? getBuiltInPersonaById(document.personaSnapshot.sourceId)
            : null
    return {
        title: document.title,
        threadId: document.source.conversationId ?? `dev-${nanoid(10)}`,
        createdAt: toDateTimeLocal(createdAt),
        updatedAt: toDateTimeLocal(document.source.updatedAt ?? createdAt),
        personaId: persona?.id ?? "",
        // Other apps' exports can carry system messages; SilkChat never sends those to a model.
        messages: document.messages.flatMap((message) =>
            message.role === "system"
                ? []
                : {
                      id: nanoid(),
                      role: message.role,
                      text: message.text,
                      modelName: message.metadata?.modelName ?? "",
                      attachments: message.attachments.map((attachment) => ({
                          id: nanoid(),
                          url: attachment.url,
                          filename: attachment.filename
                      }))
                  }
        )
    }
}

type ExportBuilderState = {
    draft: ExportDraft
    setDraft: (update: (draft: ExportDraft) => ExportDraft) => void
    resetDraft: () => void
}

export const useExportBuilderStore = create<ExportBuilderState>()(
    persist(
        (set) => ({
            draft: createExportDraft(),
            setDraft: (update) => set((state) => ({ draft: update(state.draft) })),
            resetDraft: () => set({ draft: createExportDraft() })
        }),
        { name: "dev-export-builder" }
    )
)
