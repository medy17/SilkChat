import { createContext, useContext, type ReactNode } from "react"
import { useStore } from "zustand"
import { createStore, type StoreApi } from "zustand/vanilla"
import { useModelStore, type ModelStore } from "@/lib/model-store"
import {
    resolveAssistantConfigOverride,
    type getRetryTargetAssistantConfig
} from "@/lib/assistant-config"
import type { SharedModel } from "@/convex/lib/models"

type EditSettings = Pick<
    ModelStore,
    "selectedModel" | "reasoningEffort" | "enabledTools" | "autoSelectTools"
> & { toolCallLimitPerTurn?: number }

export type ComposerModelState = ModelStore & {
    toolCallLimitPerTurn?: number
    setToolCallLimitPerTurn?: (limit: number) => void
    initialEditSettings?: EditSettings
    normalizeReasoningEffort?: ModelStore["setReasoningEffort"]
    normalizeSelectedModel?: ModelStore["setSelectedModel"]
}
const Context = createContext<StoreApi<ComposerModelState> | null>(null)
export function ComposerModelProvider({
    store,
    children
}: {
    store: StoreApi<ComposerModelState>
    children: ReactNode
}) {
    return <Context.Provider value={store}>{children}</Context.Provider>
}
const identity = (state: ComposerModelState) => state
export function useComposerModelStore<T = ComposerModelState>(
    selector: (state: ComposerModelState) => T = identity as (state: ComposerModelState) => T
): T {
    const local = useContext(Context)
    return useStore(local ?? useModelStore, selector)
}

export function useComposerModelApi() {
    return useContext(Context) ?? useModelStore
}

export function createEditModelStore(config: Partial<ComposerModelState>) {
    const initial = { ...useModelStore.getState(), ...config }
    const baseline: EditSettings = {
        selectedModel: initial.selectedModel,
        reasoningEffort: initial.reasoningEffort,
        enabledTools: [...initial.enabledTools],
        autoSelectTools: initial.autoSelectTools,
        toolCallLimitPerTurn: initial.toolCallLimitPerTurn
    }
    return createStore<ComposerModelState>((set) => ({
        ...useModelStore.getState(),
        ...config,
        initialEditSettings: baseline,
        normalizeSelectedModel: (selectedModel) =>
            set((state) => ({
                selectedModel,
                initialEditSettings:
                    state.selectedModel === state.initialEditSettings?.selectedModel
                        ? { ...state.initialEditSettings, selectedModel }
                        : state.initialEditSettings
            })),
        normalizeReasoningEffort: (reasoningEffort) =>
            set((state) => ({
                reasoningEffort,
                initialEditSettings:
                    state.selectedModel === state.initialEditSettings?.selectedModel &&
                    state.reasoningEffort === state.initialEditSettings?.reasoningEffort
                        ? { ...state.initialEditSettings, reasoningEffort }
                        : state.initialEditSettings
            })),
        setSelectedModel: (selectedModel) => set({ selectedModel }),
        setReasoningEffort: (reasoningEffort) => set({ reasoningEffort }),
        setEnabledTools: (enabledTools) => set({ enabledTools }),
        setConversationTools: (enabledTools) =>
            set((state) => ({
                enabledTools,
                initialEditSettings:
                    state.selectedModel === state.initialEditSettings?.selectedModel &&
                    JSON.stringify(state.enabledTools) ===
                        JSON.stringify(state.initialEditSettings?.enabledTools)
                        ? { ...state.initialEditSettings, enabledTools }
                        : state.initialEditSettings
            })),
        setAutoSelectTools: (autoSelectTools) => set({ autoSelectTools }),
        setToolCallLimitPerTurn: (toolCallLimitPerTurn) => set({ toolCallLimitPerTurn }),
        setSelectedImageSize: (selectedImageSize) => set({ selectedImageSize }),
        setSelectedImageResolution: (selectedImageResolution) => set({ selectedImageResolution })
    }))
}

export function hasEditSettingsChanges(state: ComposerModelState) {
    const initial = state.initialEditSettings
    return Boolean(
        initial &&
            (state.selectedModel !== initial.selectedModel ||
                state.reasoningEffort !== initial.reasoningEffort ||
                state.autoSelectTools !== initial.autoSelectTools ||
                state.toolCallLimitPerTurn !== initial.toolCallLimitPerTurn ||
                JSON.stringify(state.enabledTools) !== JSON.stringify(initial.enabledTools))
    )
}

export function createMessageEditModelStore({
    config,
    models,
    availableModels,
    toolCallLimitPerTurn
}: {
    config?: ReturnType<typeof getRetryTargetAssistantConfig>
    models: readonly SharedModel[]
    availableModels: readonly { id: string }[]
    toolCallLimitPerTurn?: number
}) {
    const current = useModelStore.getState()
    const resolved = resolveAssistantConfigOverride({
        config,
        sharedModels: models,
        availableModels,
        fallbackModelId: current.selectedModel
    })
    const generationConfig = config?.generationConfig
    return createEditModelStore({
        selectedModel:
            (availableModels.length ? resolved?.modelIdOverride : config?.modelId) ??
            current.selectedModel,
        reasoningEffort: resolved?.reasoningEffortOverride ?? current.reasoningEffort,
        toolCallLimitPerTurn: generationConfig?.toolCallLimitPerTurn ?? toolCallLimitPerTurn,
        ...(generationConfig
            ? {
                  // Existing-thread edits do not rerun opening tool selection.
                  enabledTools: [
                      ...(generationConfig.autoSelectTools
                          ? (generationConfig.resolvedTools ?? generationConfig.enabledTools)
                          : generationConfig.enabledTools)
                  ],
                  autoSelectTools: generationConfig.autoSelectTools
              }
            : {})
    })
}
