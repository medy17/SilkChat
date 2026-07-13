import { api } from "@/convex/_generated/api"
import { browserEnv, optionalBrowserEnv } from "@/lib/browser-env"
import {
    type ExportableMessage,
    type ExportablePersonaSnapshot,
    type ExportableThread,
    buildThreadsExportArchiveName,
    buildZipArchive,
    downloadBlob,
    serializeThreadToMarkdown
} from "@/lib/thread-export"

type ConvexQueryClient = {
    query: (reference: unknown, args: Record<string, unknown>) => Promise<unknown>
}

type RawThreadRecord = {
    _id: string
    title: string
    createdAt: number
    updatedAt: number
    projectId?: string
}

type RawPersonaSnapshot = ExportablePersonaSnapshot & {
    _id: string
    _creationTime: number
    threadId: string
    createdAt: number
}

type RawMessageRecord = {
    messageId: string
    role: ExportableMessage["role"]
    createdAt: number
    updatedAt: number
    parts: ExportableMessage["parts"]
    metadata?: ExportableMessage["metadata"]
}

const toExportableMessage = (value: RawMessageRecord): ExportableMessage => ({
    messageId: value.messageId,
    role: value.role,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    parts: value.parts,
    metadata: value.metadata
})

const toExportableThread = (
    value: RawThreadRecord,
    personaSnapshot: ExportablePersonaSnapshot | undefined
): ExportableThread => ({
    _id: value._id,
    title: value.title,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    projectId: value.projectId,
    personaSnapshot
})

const toExportablePersonaSnapshot = (
    value: RawPersonaSnapshot | null
): ExportablePersonaSnapshot | undefined => {
    if (!value) return undefined

    return {
        source: value.source,
        sourceId: value.sourceId,
        name: value.name,
        shortName: value.shortName,
        description: value.description,
        instructions: value.instructions,
        defaultModelId: value.defaultModelId,
        conversationStarters: value.conversationStarters,
        avatarKind: value.avatarKind,
        avatarValue: value.avatarValue,
        avatarMimeType: value.avatarMimeType,
        knowledgeDocs: value.knowledgeDocs,
        compiledPrompt: value.compiledPrompt,
        promptTokenEstimate: value.promptTokenEstimate
    }
}

const loadThreadExportData = async ({
    convex,
    threadId
}: {
    convex: ConvexQueryClient
    threadId: string
}) => {
    const [threadResult, messagesResult, personaSnapshotResult] = await Promise.all([
        convex.query(api.threads.getThread, { threadId }),
        convex.query(api.threads.getThreadMessages, { threadId }),
        convex.query(api.personas.getThreadPersonaSnapshot, { threadId })
    ])

    if (!threadResult || Array.isArray(threadResult)) {
        throw new Error("Thread not found")
    }

    if (!Array.isArray(messagesResult)) {
        throw new Error(
            typeof (messagesResult as { error?: unknown })?.error === "string"
                ? (messagesResult as { error: string }).error
                : "Failed to load thread messages"
        )
    }

    return {
        thread: toExportableThread(
            threadResult as RawThreadRecord,
            toExportablePersonaSnapshot(personaSnapshotResult as RawPersonaSnapshot | null)
        ),
        messages: (messagesResult as RawMessageRecord[]).map(toExportableMessage)
    }
}

export const exportSingleThread = async ({
    convex,
    threadId
}: {
    convex: ConvexQueryClient
    threadId: string
}) => {
    const exportedAt = Date.now()
    const { thread, messages } = await loadThreadExportData({
        convex,
        threadId
    })

    const serialized = serializeThreadToMarkdown({
        thread,
        messages,
        convexApiUrl: browserEnv("VITE_CONVEX_API_URL"),
        publicAssetBaseUrl: optionalBrowserEnv("VITE_R2_PUBLIC_BASE_URL"),
        exportedAt
    })

    downloadBlob({
        blob: new Blob([serialized.markdown], { type: "text/markdown;charset=utf-8" }),
        fileName: serialized.fileName
    })
}

export const exportMultipleThreads = async ({
    convex,
    threadIds
}: {
    convex: ConvexQueryClient
    threadIds: string[]
}) => {
    if (threadIds.length === 0) {
        throw new Error("No threads selected")
    }

    const exportedAt = Date.now()
    const bundles = await Promise.all(
        threadIds.map((threadId) =>
            loadThreadExportData({
                convex,
                threadId
            })
        )
    )

    if (bundles.length === 1) {
        const serialized = serializeThreadToMarkdown({
            thread: bundles[0].thread,
            messages: bundles[0].messages,
            convexApiUrl: browserEnv("VITE_CONVEX_API_URL"),
            publicAssetBaseUrl: optionalBrowserEnv("VITE_R2_PUBLIC_BASE_URL"),
            exportedAt
        })

        downloadBlob({
            blob: new Blob([serialized.markdown], { type: "text/markdown;charset=utf-8" }),
            fileName: serialized.fileName
        })
        return
    }

    const files = bundles.map(({ thread, messages }) =>
        serializeThreadToMarkdown({
            thread,
            messages,
            convexApiUrl: browserEnv("VITE_CONVEX_API_URL"),
            publicAssetBaseUrl: optionalBrowserEnv("VITE_R2_PUBLIC_BASE_URL"),
            exportedAt
        })
    )

    const archive = buildZipArchive(
        files.map((file) => ({
            name: file.fileName,
            content: file.markdown
        }))
    )

    downloadBlob({
        blob: archive,
        fileName: buildThreadsExportArchiveName({
            exportedAt,
            threadCount: files.length
        })
    })
}
