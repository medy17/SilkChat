import type { SharedModel } from "@/convex/lib/models"
import { isModelSunset, resolveModelReplacement } from "@/convex/lib/models/lifecycle"
import { useEffect } from "react"
import { toast } from "sonner"

const TOAST_KEY_PREFIX = "model-lifecycle-toast"

const getToastKey = (original: SharedModel, replacement: SharedModel) =>
    `${TOAST_KEY_PREFIX}:${original.id}:${original.sunsetOn ?? "unknown"}:${replacement.id}`

const hasSeenToast = (key: string) => {
    if (typeof window === "undefined") return true
    try {
        return window.localStorage.getItem(key) === "true"
    } catch {
        return false
    }
}

const markToastSeen = (key: string) => {
    if (typeof window === "undefined") return
    try {
        window.localStorage.setItem(key, "true")
    } catch {}
}

const formatSunsetDate = (date: string) => {
    const parsed = new Date(`${date}T00:00:00Z`)
    if (Number.isNaN(parsed.getTime())) return date

    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC"
    }).format(parsed)
}

export const notifyModelReplacement = (original: SharedModel, replacement: SharedModel) => {
    if (!original.sunsetOn) return

    const key = getToastKey(original, replacement)
    if (hasSeenToast(key)) return

    toast.warning(
        `Unfortunately, ${original.name} was deprecated on ${formatSunsetDate(
            original.sunsetOn
        )}. You may continue this conversation with ${replacement.name}.`
    )
    markToastSeen(key)
}

export const resolveAvailableModelReplacement = ({
    modelId,
    sharedModels,
    availableModels,
    fallbackModelId
}: {
    modelId: string
    sharedModels: readonly SharedModel[]
    availableModels: readonly { id: string }[]
    fallbackModelId?: string | null
}) => {
    const availableIds = new Set(availableModels.map((model) => model.id))
    const lifecycleResolution = resolveModelReplacement(modelId, sharedModels, {
        isCandidateAllowed: (model) => availableIds.has(model.id)
    })

    const replacementId =
        lifecycleResolution.resolvedId && lifecycleResolution.resolvedId !== modelId
            ? lifecycleResolution.resolvedId
            : fallbackModelId && fallbackModelId !== modelId
              ? fallbackModelId
              : null

    const replacement = replacementId
        ? sharedModels.find((model) => model.id === replacementId)
        : undefined

    return {
        ...lifecycleResolution,
        replacementId,
        replacement
    }
}

export const useSelectedModelLifecycleMigration = ({
    selectedModel,
    setSelectedModel,
    sharedModels,
    availableModels,
    fallbackModelId
}: {
    selectedModel: string | null
    setSelectedModel: (modelId: string) => void
    sharedModels: readonly SharedModel[]
    availableModels: readonly { id: string }[]
    fallbackModelId?: string | null
}) => {
    useEffect(() => {
        if (!selectedModel || sharedModels.length === 0 || availableModels.length === 0) return

        const original = sharedModels.find((model) => model.id === selectedModel)
        if (!original || !isModelSunset(original)) return

        const resolution = resolveAvailableModelReplacement({
            modelId: selectedModel,
            sharedModels,
            availableModels,
            fallbackModelId
        })

        if (!resolution.replacementId || !resolution.replacement) return

        setSelectedModel(resolution.replacementId)
        notifyModelReplacement(original, resolution.replacement)
    }, [availableModels, fallbackModelId, selectedModel, setSelectedModel, sharedModels])
}
