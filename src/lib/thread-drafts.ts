import type { UploadedFile } from "@/lib/chat-store"

const THREAD_DRAFTS_STORAGE_KEY = "silkchat:thread-drafts:v1"
const LEGACY_USER_INPUT_KEY = "user-input"
const THREAD_DRAFTS_VERSION = 1

export type ThreadDraftScope = {
    threadId?: string
    folderId?: string
}

export type ThreadDraft = ThreadDraftScope & {
    key: string
    text: string
    attachments: UploadedFile[]
    updatedAt: number
}

type ThreadDraftRegistry = {
    version: typeof THREAD_DRAFTS_VERSION
    drafts: Record<string, ThreadDraft>
    pendingAttachmentDeletes: string[]
}

const emptyRegistry = (): ThreadDraftRegistry => ({
    version: THREAD_DRAFTS_VERSION,
    drafts: {},
    pendingAttachmentDeletes: []
})

const getStorage = (): Storage | undefined => {
    if (typeof window === "undefined") return undefined

    try {
        return window.localStorage
    } catch {
        return undefined
    }
}

const isUploadedFile = (value: unknown): value is UploadedFile => {
    if (!value || typeof value !== "object") return false
    const candidate = value as Partial<UploadedFile>
    return (
        typeof candidate.key === "string" &&
        typeof candidate.fileName === "string" &&
        typeof candidate.fileType === "string" &&
        typeof candidate.fileSize === "number" &&
        typeof candidate.uploadedAt === "number"
    )
}

const isThreadDraft = (value: unknown): value is ThreadDraft => {
    if (!value || typeof value !== "object") return false
    const candidate = value as Partial<ThreadDraft>
    return (
        typeof candidate.key === "string" &&
        typeof candidate.text === "string" &&
        typeof candidate.updatedAt === "number" &&
        Array.isArray(candidate.attachments) &&
        candidate.attachments.every(isUploadedFile)
    )
}

const readRegistry = (): ThreadDraftRegistry => {
    const storage = getStorage()
    if (!storage) return emptyRegistry()

    try {
        const serialized = storage.getItem(THREAD_DRAFTS_STORAGE_KEY)
        if (!serialized) return emptyRegistry()

        const parsed = JSON.parse(serialized) as Partial<ThreadDraftRegistry>
        if (
            parsed.version !== THREAD_DRAFTS_VERSION ||
            !parsed.drafts ||
            typeof parsed.drafts !== "object" ||
            !Array.isArray(parsed.pendingAttachmentDeletes)
        ) {
            return emptyRegistry()
        }

        return {
            version: THREAD_DRAFTS_VERSION,
            drafts: Object.fromEntries(
                Object.entries(parsed.drafts).filter((entry): entry is [string, ThreadDraft] =>
                    isThreadDraft(entry[1])
                )
            ),
            pendingAttachmentDeletes: parsed.pendingAttachmentDeletes.filter(
                (key): key is string => typeof key === "string"
            )
        }
    } catch {
        return emptyRegistry()
    }
}

const writeRegistry = (registry: ThreadDraftRegistry): boolean => {
    const storage = getStorage()
    if (!storage) return false

    try {
        storage.setItem(THREAD_DRAFTS_STORAGE_KEY, JSON.stringify(registry))
        return true
    } catch {
        return false
    }
}

const attachmentKeysFromDrafts = (drafts: ThreadDraft[]) => [
    ...new Set(drafts.flatMap((draft) => draft.attachments.map((file) => file.key)))
]

const removeDrafts = (matches: (draft: ThreadDraft) => boolean) => {
    const registry = readRegistry()
    const removedDrafts = Object.values(registry.drafts).filter(matches)
    if (removedDrafts.length === 0) return []

    for (const draft of removedDrafts) {
        delete registry.drafts[draft.key]
    }

    const attachmentKeys = attachmentKeysFromDrafts(removedDrafts)
    registry.pendingAttachmentDeletes = [
        ...new Set([...registry.pendingAttachmentDeletes, ...attachmentKeys])
    ]
    writeRegistry(registry)
    return attachmentKeys
}

export const getThreadDraftKey = ({ threadId, folderId }: ThreadDraftScope) => {
    if (threadId) return `thread:${threadId}`
    if (folderId) return `folder:${folderId}:new`
    return "new"
}

export const loadThreadDraft = (scope: ThreadDraftScope): ThreadDraft | undefined => {
    const key = getThreadDraftKey(scope)
    const draft = readRegistry().drafts[key]
    if (draft) return draft

    const storage = getStorage()
    const legacyText = storage?.getItem(LEGACY_USER_INPUT_KEY) ?? ""
    if (!legacyText) return undefined

    storage?.removeItem(LEGACY_USER_INPUT_KEY)
    const migratedDraft: ThreadDraft = {
        ...scope,
        key,
        text: legacyText,
        attachments: [],
        updatedAt: Date.now()
    }
    saveThreadDraft(migratedDraft)
    return migratedDraft
}

export const saveThreadDraft = (draft: ThreadDraft): boolean => {
    const registry = readRegistry()
    const storedDraft: ThreadDraft = {
        ...draft,
        // The uploaded object is the durable draft state. Keeping the source paste here can
        // stringify megabytes on every composer edit and can exceed localStorage quotas.
        attachments: draft.attachments.map(
            ({ largePasteContent: _largePasteContent, ...attachment }) => attachment
        )
    }
    const existing = registry.drafts[draft.key]

    if (!draft.text && draft.attachments.length === 0) {
        if (!existing) return true
        delete registry.drafts[draft.key]
        return writeRegistry(registry)
    }

    if (
        existing &&
        existing.text === storedDraft.text &&
        existing.threadId === storedDraft.threadId &&
        existing.folderId === storedDraft.folderId &&
        JSON.stringify(existing.attachments) === JSON.stringify(storedDraft.attachments)
    ) {
        return true
    }

    registry.drafts[draft.key] = storedDraft
    return writeRegistry(registry)
}

export const clearThreadDraft = (scope: ThreadDraftScope): void => {
    const registry = readRegistry()
    delete registry.drafts[getThreadDraftKey(scope)]
    writeRegistry(registry)
}

export const cascadeDeleteThreadDraft = (threadId: string): string[] =>
    removeDrafts((draft) => draft.threadId === threadId)

export const cascadeDeleteFolderDrafts = (
    folderId: string,
    deletedThreadIds: readonly string[] = []
): string[] => {
    const threadIds = new Set(deletedThreadIds)
    return removeDrafts(
        (draft) =>
            draft.folderId === folderId || Boolean(draft.threadId && threadIds.has(draft.threadId))
    )
}

export const getPendingDraftAttachmentDeletes = (): string[] => [
    ...readRegistry().pendingAttachmentDeletes
]

export const acknowledgeDraftAttachmentDelete = (key: string): void => {
    const registry = readRegistry()
    registry.pendingAttachmentDeletes = registry.pendingAttachmentDeletes.filter(
        (pendingKey) => pendingKey !== key
    )
    writeRegistry(registry)
}
