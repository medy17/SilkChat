import type { ImageResolution, ImageSize, ReasoningEffortTier } from "@/convex/lib/models"
import {
    type AIConfig,
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
    setEnabledTools: (tools: AbilityId[]) => void

    selectedImageSize: ImageSize
    setSelectedImageSize: (imageSize: ImageSize) => void

    selectedImageResolution: ImageResolution
    setSelectedImageResolution: (imageResolution: ImageResolution) => void

    reasoningEffort: ReasoningEffort
    setReasoningEffort: (effort: ReasoningEffort) => void
}

if (typeof window !== "undefined") {
    // TODO(next commit): Remove this one-off existing-user migration and its tests/export.
    setDefaultModelToLunaOnce(window.localStorage)
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
            enabledTools: initialConfig.enabledTools as AbilityId[],
            selectedImageSize: initialConfig.selectedImageSize as ImageSize,
            selectedImageResolution: initialConfig.selectedImageResolution as ImageResolution,
            reasoningEffort: initialConfig.reasoningEffort as ReasoningEffort,
            setSelectedModel: (model) => {
                const currentState = get()
                if (currentState.selectedModel !== model) {
                    set({ selectedModel: model })
                    persistConfig(
                        model,
                        currentState.enabledTools,
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
                    set({ enabledTools: tools })
                    persistConfig(
                        currentState.selectedModel,
                        tools,
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
                        currentState.enabledTools,
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
                        currentState.enabledTools,
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
                        currentState.enabledTools,
                        currentState.selectedImageSize,
                        currentState.selectedImageResolution,
                        effort
                    )
                }
            }
        }),
        {
            name: "model-storage"
        }
    )
)
