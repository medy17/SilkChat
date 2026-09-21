import type { ImageResolution, ImageSize, ReasoningEffortTier } from "@/convex/lib/models"
import {
    type AIConfig,
    enableHostedMemoryOnce,
    loadAIConfig,
    saveAIConfig,
    setDefaultModelToLunaOnce
} from "@/lib/persistence"
import type { AbilityId } from "@/lib/tool-abilities"
import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ReasoningEffort = ReasoningEffortTier

export type ModelStore = {
    selectedModel: string | null
    setSelectedModel: (model: string | null) => void

    enabledTools: AbilityId[]
    manualTools: AbilityId[]
    toolThreadId: string | null
    conversationTools: Record<string, AbilityId[]>
    manuallyEditedThreads: Record<string, boolean>
    toolRevision: number
    toolDraftGeneration: number
    draftToolOverride: { revision: number; tools: AbilityId[] } | null
    startNewToolSelection: () => void
    activateToolThread: (threadId: string | null, savedTools?: AbilityId[]) => void
    restoreConversationTools: (
        threadId: string,
        tools: AbilityId[],
        requestRevision?: number,
        draftGeneration?: number
    ) => void
    setConversationTools: (tools: AbilityId[]) => void
    setEnabledTools: (tools: AbilityId[]) => void
    autoSelectTools: boolean
    setAutoSelectTools: (enabled: boolean) => void

    selectedImageSize: ImageSize
    setSelectedImageSize: (imageSize: ImageSize) => void

    selectedImageResolution: ImageResolution
    setSelectedImageResolution: (imageResolution: ImageResolution) => void

    reasoningEffort: ReasoningEffort
    setReasoningEffort: (effort: ReasoningEffort) => void
}

if (typeof window !== "undefined") {
    // One-time preference rollouts for existing browsers.
    setDefaultModelToLunaOnce(window.localStorage)
    enableHostedMemoryOnce(window.localStorage)
}

const initialConfig = loadAIConfig()

const persistConfig = (
    selectedModel: string | null,
    enabledTools: AbilityId[],
    selectedImageSize: ImageSize,
    selectedImageResolution: ImageResolution,
    reasoningEffort: ReasoningEffort
) => {
    const config: AIConfig = {
        selectedModel,
        enabledTools,
        selectedImageSize,
        selectedImageResolution,
        reasoningEffort
    }
    saveAIConfig(config)
}

export const useModelStore = create<ModelStore>()(
    persist(
        (set, get) => ({
            selectedModel: initialConfig.selectedModel,
            enabledTools: [],
            manualTools: initialConfig.enabledTools as AbilityId[],
            toolThreadId: null,
            conversationTools: {},
            manuallyEditedThreads: {},
            toolRevision: 0,
            toolDraftGeneration: 0,
            draftToolOverride: null,
            startNewToolSelection: () =>
                set((state) => ({
                    toolThreadId: null,
                    enabledTools: state.autoSelectTools ? [] : [...state.manualTools],
                    toolRevision: state.toolRevision + 1,
                    toolDraftGeneration: state.toolDraftGeneration + 1,
                    draftToolOverride: null
                })),
            activateToolThread: (threadId, savedTools) => {
                const state = get()
                if (state.toolThreadId === threadId) {
                    if (threadId && savedTools && !state.conversationTools[threadId])
                        state.restoreConversationTools(threadId, savedTools)
                    return
                }
                if (threadId === null) {
                    state.startNewToolSelection()
                    return
                }
                set({
                    toolThreadId: threadId,
                    ...(threadId && savedTools && !state.conversationTools[threadId]
                        ? {
                              conversationTools: {
                                  ...state.conversationTools,
                                  [threadId]: savedTools
                              }
                          }
                        : {}),
                    enabledTools: threadId
                        ? (state.conversationTools[threadId] ?? savedTools ?? [])
                        : state.autoSelectTools
                          ? []
                          : [...state.manualTools]
                })
            },
            restoreConversationTools: (threadId, tools, requestRevision, draftGeneration) => {
                const state = get()
                // Local manual choices win over delayed selection or subscription data.
                const draftOverride =
                    requestRevision !== undefined &&
                    draftGeneration === state.toolDraftGeneration &&
                    state.draftToolOverride &&
                    state.draftToolOverride.revision > requestRevision
                        ? state.draftToolOverride.tools
                        : undefined
                const selected = state.manuallyEditedThreads[threadId]
                    ? (state.conversationTools[threadId] ?? tools)
                    : (draftOverride ?? tools)
                set({
                    conversationTools: { ...state.conversationTools, [threadId]: selected },
                    ...(draftOverride
                        ? {
                              manuallyEditedThreads: {
                                  ...state.manuallyEditedThreads,
                                  [threadId]: true
                              }
                          }
                        : {}),
                    ...(state.toolThreadId === threadId ? { enabledTools: selected } : {})
                })
            },
            setConversationTools: (tools) =>
                set((state) => ({
                    enabledTools: tools,
                    ...(state.toolThreadId
                        ? {
                              conversationTools: {
                                  ...state.conversationTools,
                                  [state.toolThreadId]: tools
                              }
                          }
                        : {})
                })),
            autoSelectTools: true,
            setAutoSelectTools: (enabled) =>
                set((state) => ({
                    autoSelectTools: enabled,
                    ...(state.toolThreadId === null
                        ? {
                              enabledTools: enabled ? [] : [...state.manualTools],
                              toolRevision: state.toolRevision + 1
                          }
                        : {})
                })),
            selectedImageSize: initialConfig.selectedImageSize as ImageSize,
            selectedImageResolution: initialConfig.selectedImageResolution as ImageResolution,
            reasoningEffort: initialConfig.reasoningEffort as ReasoningEffort,
            setSelectedModel: (model) => {
                const currentState = get()
                if (currentState.selectedModel !== model) {
                    set({ selectedModel: model })
                    persistConfig(
                        model,
                        currentState.manualTools,
                        currentState.selectedImageSize,
                        currentState.selectedImageResolution,
                        currentState.reasoningEffort
                    )
                }
            },
            setEnabledTools: (tools) => {
                const currentState = get()
                const hasChanged =
                    tools.length !== currentState.enabledTools.length ||
                    tools.some((tool, index) => tool !== currentState.enabledTools[index])

                if (hasChanged) {
                    const added = tools.filter((tool) => !currentState.enabledTools.includes(tool))
                    const removed = currentState.enabledTools.filter(
                        (tool) => !tools.includes(tool)
                    )
                    const manualTools = [
                        ...new Set([
                            ...currentState.manualTools.filter((tool) => !removed.includes(tool)),
                            ...added
                        ])
                    ]
                    set({
                        enabledTools: tools,
                        manualTools,
                        toolRevision: currentState.toolRevision + 1,
                        ...(currentState.toolThreadId === null
                            ? {
                                  draftToolOverride: {
                                      revision: currentState.toolRevision + 1,
                                      tools
                                  }
                              }
                            : {}),
                        ...(currentState.toolThreadId
                            ? {
                                  conversationTools: {
                                      ...currentState.conversationTools,
                                      [currentState.toolThreadId]: tools
                                  },
                                  manuallyEditedThreads: {
                                      ...currentState.manuallyEditedThreads,
                                      [currentState.toolThreadId]: true
                                  }
                              }
                            : {})
                    })
                    persistConfig(
                        currentState.selectedModel,
                        manualTools,
                        currentState.selectedImageSize,
                        currentState.selectedImageResolution,
                        currentState.reasoningEffort
                    )
                }
            },
            setSelectedImageSize: (imageSize) => {
                const currentState = get()
                if (currentState.selectedImageSize !== imageSize) {
                    set({ selectedImageSize: imageSize })
                    persistConfig(
                        currentState.selectedModel,
                        currentState.manualTools,
                        imageSize,
                        currentState.selectedImageResolution,
                        currentState.reasoningEffort
                    )
                }
            },
            setSelectedImageResolution: (imageResolution) => {
                const currentState = get()
                if (currentState.selectedImageResolution !== imageResolution) {
                    set({ selectedImageResolution: imageResolution })
                    persistConfig(
                        currentState.selectedModel,
                        currentState.manualTools,
                        currentState.selectedImageSize,
                        imageResolution,
                        currentState.reasoningEffort
                    )
                }
            },
            setReasoningEffort: (effort) => {
                const currentState = get()
                if (currentState.reasoningEffort !== effort) {
                    set({ reasoningEffort: effort })
                    persistConfig(
                        currentState.selectedModel,
                        currentState.manualTools,
                        currentState.selectedImageSize,
                        currentState.selectedImageResolution,
                        effort
                    )
                }
            }
        }),
        {
            name: "model-storage",
            partialize: (state) => ({
                selectedModel: state.selectedModel,
                manualTools: state.manualTools,
                conversationTools: state.conversationTools,
                manuallyEditedThreads: state.manuallyEditedThreads,
                autoSelectTools: state.autoSelectTools,
                selectedImageSize: state.selectedImageSize,
                selectedImageResolution: state.selectedImageResolution,
                reasoningEffort: state.reasoningEffort
            }),
            merge: (persisted, current) => {
                const saved = persisted as Partial<ModelStore> | undefined
                const manualTools = saved?.manualTools ?? saved?.enabledTools ?? current.manualTools
                const autoSelectTools = saved?.autoSelectTools ?? true
                return {
                    ...current,
                    ...saved,
                    manualTools,
                    autoSelectTools,
                    enabledTools: autoSelectTools ? [] : [...manualTools],
                    toolThreadId: null,
                    conversationTools: saved?.conversationTools ?? {},
                    manuallyEditedThreads: saved?.manuallyEditedThreads ?? {},
                    draftToolOverride: null
                }
            }
        }
    )
)
