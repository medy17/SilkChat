import type { UIMessage } from "ai"
import { nanoid } from "nanoid"
import { create } from "zustand"

export type ChatMessageMetadata = {
    modelId?: string
    modelName?: string
    displayProvider?: string
    runtimeProvider?: string
    reasoningEffort?: string
    promptTokens?: number
    completionTokens?: number
    reasoningTokens?: number
    totalTokens?: number
    estimatedCostUsd?: number
    estimatedPromptCostUsd?: number
    estimatedCompletionCostUsd?: number
    serverDurationMs?: number
    timeToFirstVisibleMs?: number
    threadId?: string
    streamId?: string
    modelIdOverride?: string
    reasoningEffortOverride?: string
}

export type ChatMessage = UIMessage<ChatMessageMetadata>

export interface UploadedFile {
    key: string
    fileName: string
    fileType: string
    fileSize: number
    uploadedAt: number
}

export type PersonaSelection =
    | {
          source: "default"
          id?: undefined
      }
    | {
          source: "builtin" | "user"
          id: string
      }

export type PendingPersonaOpening = {
    source: "builtin" | "user"
    personaId: string
    openingId: string
    messageId: string
    text: string
    suggestedReplies: string[]
}

export type PendingBranchRetry = {
    threadId: string
    messageId: string
}

export type PendingBranchHydration = {
    threadId: string
    messages: ChatMessage[]
}

export type PendingBranchGenerations = Record<string, boolean>

interface ChatState {
    threadId: string | undefined
    uploadedFiles: UploadedFile[]
    rerenderTrigger: string
    lastProcessedDataIndex: number
    shouldUpdateQuery: boolean
    skipNextDataCheck: boolean
    attachedStreamIds: Record<string, string[]>
    pendingStreams: Record<string, boolean>
    pendingStreamOwnerClientIds: Record<string, string | undefined>
    manuallyStoppedThreads: Record<string, boolean>
    targetFromMessageId: string | undefined
    targetMode: "normal" | "edit" | "retry"
    uploading: boolean
    selectedPersona: PersonaSelection
    pendingPersonaOpening: PendingPersonaOpening | undefined
    lastLocalMutationAt: number
    pendingBranchRetry: PendingBranchRetry | undefined
    pendingBranchHydration: PendingBranchHydration | undefined
    pendingBranchGenerations: PendingBranchGenerations
}

interface ChatActions {
    setThreadId: (threadId: string | undefined) => void
    setUploadedFiles: (files: UploadedFile[]) => void
    addUploadedFile: (file: UploadedFile) => void
    removeUploadedFile: (key: string) => void
    setLastProcessedDataIndex: (index: number) => void
    setShouldUpdateQuery: (should: boolean) => void
    setSkipNextDataCheck: (skip: boolean) => void
    resetChat: () => void
    triggerRerender: () => void
    setAttachedStreamId: (threadId: string, streamId: string) => void
    setPendingStream: (threadId: string, pending: boolean, ownerClientId?: string) => void
    setManuallyStoppedThread: (threadId: string, stopped: boolean) => void
    setTargetFromMessageId: (messageId: string | undefined) => void
    setTargetMode: (mode: "normal" | "edit" | "retry") => void
    setUploading: (uploading: boolean) => void
    setRerenderTrigger: (rerenderTrigger: string) => void
    setSelectedPersona: (persona: PersonaSelection) => void
    setPendingPersonaOpening: (opening: PendingPersonaOpening | undefined) => void
    setLastLocalMutationAt: (time: number) => void
    setPendingBranchRetry: (pendingBranchRetry: PendingBranchRetry | undefined) => void
    setPendingBranchHydration: (pendingBranchHydration: PendingBranchHydration | undefined) => void
    setPendingBranchGeneration: (threadId: string, pending: boolean) => void
}

const initialState: ChatState = {
    threadId: undefined,
    uploadedFiles: [],
    rerenderTrigger: nanoid(),
    lastProcessedDataIndex: -1,
    shouldUpdateQuery: false,
    skipNextDataCheck: true,
    attachedStreamIds: {},
    pendingStreams: {},
    pendingStreamOwnerClientIds: {},
    manuallyStoppedThreads: {},
    targetFromMessageId: undefined,
    targetMode: "normal",
    uploading: false,
    selectedPersona: { source: "default" },
    pendingPersonaOpening: undefined,
    lastLocalMutationAt: 0,
    pendingBranchRetry: undefined,
    pendingBranchHydration: undefined,
    pendingBranchGenerations: {}
}

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
    ...initialState,

    setThreadId: (threadId) => set({ threadId }),
    setUploadedFiles: (uploadedFiles) => set({ uploadedFiles }),
    addUploadedFile: (file) =>
        set((state) => ({
            uploadedFiles: [...state.uploadedFiles, file]
        })),
    removeUploadedFile: (key) =>
        set((state) => ({
            uploadedFiles: state.uploadedFiles.filter((f) => f.key !== key)
        })),
    setLastProcessedDataIndex: (lastProcessedDataIndex) => set({ lastProcessedDataIndex }),
    setShouldUpdateQuery: (shouldUpdateQuery) => set({ shouldUpdateQuery }),
    setSkipNextDataCheck: (skipNextDataCheck) => set({ skipNextDataCheck }),
    setUploading: (uploading) => set({ uploading }),
    setRerenderTrigger: (rerenderTrigger) => set({ rerenderTrigger }),
    setSelectedPersona: (selectedPersona) => set({ selectedPersona }),
    setPendingPersonaOpening: (pendingPersonaOpening) => set({ pendingPersonaOpening }),
    setLastLocalMutationAt: (lastLocalMutationAt) => set({ lastLocalMutationAt }),
    setPendingBranchRetry: (pendingBranchRetry) => set({ pendingBranchRetry }),
    setPendingBranchHydration: (pendingBranchHydration) => set({ pendingBranchHydration }),
    setPendingBranchGeneration: (threadId, pending) =>
        set((state) => {
            if (pending) {
                return {
                    pendingBranchGenerations: {
                        ...state.pendingBranchGenerations,
                        [threadId]: true
                    }
                }
            }

            const pendingBranchGenerations = { ...state.pendingBranchGenerations }
            delete pendingBranchGenerations[threadId]
            return { pendingBranchGenerations }
        }),
    resetChat: () => {
        const { pendingBranchRetry, pendingBranchHydration, pendingBranchGenerations } = get()

        set({
            ...initialState,
            rerenderTrigger: nanoid(),
            attachedStreamIds: {},
            pendingStreamOwnerClientIds: {},
            manuallyStoppedThreads: {},
            targetFromMessageId: undefined,
            lastProcessedDataIndex: -1,
            skipNextDataCheck: true,
            targetMode: "normal",
            threadId: undefined,
            pendingBranchRetry,
            pendingBranchHydration,
            pendingBranchGenerations
        })
    },

    triggerRerender: () => {
        set({ rerenderTrigger: nanoid() })
    },

    setAttachedStreamId: (threadId, streamId) => {
        if (!threadId) return
        set((state) => {
            const currentStreams = state.attachedStreamIds[threadId] || []
            if (currentStreams.includes(streamId)) return state
            return {
                attachedStreamIds: {
                    ...state.attachedStreamIds,
                    [threadId]: [...currentStreams, streamId]
                }
            }
        })
    },

    setPendingStream: (threadId, pending, ownerClientId) => {
        if (!threadId) return
        set((state) => ({
            pendingStreams: {
                ...state.pendingStreams,
                [threadId]: pending
            },
            pendingStreamOwnerClientIds: {
                ...state.pendingStreamOwnerClientIds,
                [threadId]: pending ? ownerClientId : undefined
            }
        }))
    },

    setManuallyStoppedThread: (threadId, stopped) => {
        if (!threadId) return
        set((state) => ({
            manuallyStoppedThreads: {
                ...state.manuallyStoppedThreads,
                [threadId]: stopped
            }
        }))
    },

    setTargetFromMessageId: (messageId) => set({ targetFromMessageId: messageId }),

    setTargetMode: (mode) => set({ targetMode: mode })
}))
