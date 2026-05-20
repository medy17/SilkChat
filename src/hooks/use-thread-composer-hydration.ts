import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { SharedModel } from "@/convex/lib/models"
import { getLatestAssistantConfig, resolveAssistantConfigOverride } from "@/lib/assistant-config"
import type { ReasoningEffort } from "@/lib/model-store"
import { useQuery as useConvexQuery } from "convex-helpers/react/cache"
import { useEffect, useRef } from "react"

export const useThreadComposerHydration = ({
    threadId,
    sharedModels,
    availableModels,
    fallbackModelId,
    selectedModel,
    reasoningEffort,
    setSelectedModel,
    setReasoningEffort
}: {
    threadId: string | undefined
    sharedModels: readonly SharedModel[]
    availableModels: readonly { id: string }[]
    fallbackModelId?: string | null
    selectedModel: string | null
    reasoningEffort: ReasoningEffort
    setSelectedModel: (modelId: string | null) => void
    setReasoningEffort: (effort: ReasoningEffort) => void
}) => {
    const hydratedThreadIdRef = useRef<string | undefined>(undefined)
    const threadMessages = useConvexQuery(
        api.threads.getThreadMessages,
        threadId ? { threadId: threadId as Id<"threads"> } : "skip"
    )

    useEffect(() => {
        if (!threadId) {
            hydratedThreadIdRef.current = undefined
            return
        }

        if (hydratedThreadIdRef.current === threadId) {
            return
        }

        if (!threadMessages || "error" in threadMessages) {
            return
        }

        const latestAssistantConfig = getLatestAssistantConfig(threadMessages)
        const resolvedConfig = resolveAssistantConfigOverride({
            config: latestAssistantConfig,
            sharedModels,
            availableModels,
            fallbackModelId
        })

        if (resolvedConfig?.modelIdOverride && resolvedConfig.modelIdOverride !== selectedModel) {
            setSelectedModel(resolvedConfig.modelIdOverride)
        }

        if (
            resolvedConfig?.reasoningEffortOverride &&
            resolvedConfig.reasoningEffortOverride !== reasoningEffort
        ) {
            setReasoningEffort(resolvedConfig.reasoningEffortOverride)
        }

        hydratedThreadIdRef.current = threadId
    }, [
        availableModels,
        fallbackModelId,
        reasoningEffort,
        selectedModel,
        setReasoningEffort,
        setSelectedModel,
        sharedModels,
        threadId,
        threadMessages
    ])
}
