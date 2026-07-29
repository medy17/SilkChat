import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { SharedModel } from "@/convex/lib/models"
import { getLatestAssistantConfig, resolveAssistantConfigOverride } from "@/lib/assistant-config"
import type { ReasoningEffort } from "@/lib/model-store"
import { useQuery as useConvexQuery } from "convex-helpers/react/cache"
import { useConvexAuth } from "convex/react"
import { useEffect, useState } from "react"

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
    const auth = useConvexAuth()
    const [hydratedThreadId, setHydratedThreadId] = useState<string | undefined>(undefined)
    const threadMessages = useConvexQuery(
        api.threads.getThreadMessages,
        threadId && !auth.isLoading && hydratedThreadId !== threadId
            ? { threadId: threadId as Id<"threads"> }
            : "skip"
    )

    useEffect(() => {
        if (!threadId) {
            setHydratedThreadId(undefined)
            return
        }

        if (hydratedThreadId === threadId) {
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

        setHydratedThreadId(threadId)
    }, [
        availableModels,
        fallbackModelId,
        hydratedThreadId,
        reasoningEffort,
        selectedModel,
        setReasoningEffort,
        setSelectedModel,
        sharedModels,
        threadId,
        threadMessages
    ])
}
