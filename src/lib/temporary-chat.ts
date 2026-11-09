import { create } from "zustand"

// A temporary chat belongs to the tab that started it. sessionStorage survives a reload
// but not closing the tab, so a reopened URL finds no marker and the chat reads as ended.
const OWNED_THREADS_KEY = "silkchat:temporary-threads"

const readOwnedThreads = (): string[] => {
    try {
        const raw = window.sessionStorage.getItem(OWNED_THREADS_KEY)
        const parsed: unknown = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []
    } catch {
        return []
    }
}

const writeOwnedThreads = (threadIds: string[]) => {
    try {
        window.sessionStorage.setItem(OWNED_THREADS_KEY, JSON.stringify(threadIds))
    } catch {
        // Without storage the chat simply ends on reload.
    }
}

export const isTemporaryThreadOwnedHere = (threadId: string) =>
    typeof window !== "undefined" && readOwnedThreads().includes(threadId)

export const markTemporaryThreadOwned = (threadId: string) => {
    const owned = readOwnedThreads()
    if (!owned.includes(threadId)) writeOwnedThreads([...owned, threadId])
}

export const forgetTemporaryThread = (threadId: string) => {
    writeOwnedThreads(readOwnedThreads().filter((id) => id !== threadId))
}

type TemporaryChatState = {
    // The new-chat toggle. It applies to the next chat started from the composer.
    draftEnabled: boolean
    // The assistant message id of a temporary send still waiting for its thread id.
    pendingMessageId: string | undefined
    setDraftEnabled: (enabled: boolean) => void
    beginRequest: (assistantMessageId: string) => void
    // The server created the thread: this tab owns it and the toggle has done its job.
    claimThread: (assistantMessageId: string, threadId: string) => void
    cancelRequest: () => void
}

export const useTemporaryChatStore = create<TemporaryChatState>((set, get) => ({
    draftEnabled: false,
    pendingMessageId: undefined,
    setDraftEnabled: (draftEnabled) => set({ draftEnabled }),
    beginRequest: (pendingMessageId) => set({ pendingMessageId }),
    claimThread: (assistantMessageId, threadId) => {
        if (get().pendingMessageId !== assistantMessageId) return
        markTemporaryThreadOwned(threadId)
        set({ draftEnabled: false, pendingMessageId: undefined })
    },
    cancelRequest: () => set({ pendingMessageId: undefined })
}))

export const getTemporaryThreadIdFromPath = (pathname: string) =>
    /^\/thread\/([^/]+)\/?$/.exec(pathname)?.[1]
