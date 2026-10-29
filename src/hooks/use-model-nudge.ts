import type { SharedModel } from "@/convex/lib/models"
import {
    type ModelNudge,
    type ModelNudgeState,
    getModelNudgeMessage,
    isModelNudgeSnoozed,
    resolveModelNudge,
    snoozeModelNudge
} from "@/lib/model-nudge"
import { getRequiredPlanToPickModel } from "@/lib/models-providers-shared"
import { useCallback, useMemo, useState } from "react"

const STORAGE_KEY_PREFIX = "model-nudge"

const getStorageKey = ({ original, replacement }: ModelNudge) =>
    `${STORAGE_KEY_PREFIX}:${original.id}:${replacement.id}`

const readNudgeState = (key: string): ModelNudgeState | null => {
    if (typeof window === "undefined") return null
    try {
        const raw = window.localStorage.getItem(key)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<ModelNudgeState>
        return {
            snoozedUntil: Number(parsed.snoozedUntil) || 0,
            messageIndex: Number(parsed.messageIndex) || 0
        }
    } catch {
        return null
    }
}

const writeNudgeState = (key: string, state: ModelNudgeState | null) => {
    if (typeof window === "undefined") return
    try {
        if (state) window.localStorage.setItem(key, JSON.stringify(state))
        else window.localStorage.removeItem(key)
    } catch {}
}

export const useModelNudge = ({
    selectedModel,
    setSelectedModel,
    sharedModels,
    availableModels,
    creditPlan
}: {
    selectedModel: string | null
    setSelectedModel: (modelId: string) => void
    sharedModels: readonly SharedModel[]
    availableModels: readonly { id: string }[]
    creditPlan: "free" | "pro" | null | undefined
}) => {
    // Bumped after each write so the stored state is read again.
    const [storageVersion, setStorageVersion] = useState(0)

    const nudge = useMemo(() => {
        if (!selectedModel) return null
        const availableIds = new Set(availableModels.map((model) => model.id))

        return resolveModelNudge({
            modelId: selectedModel,
            sharedModels,
            isCandidateAllowed: (model) =>
                availableIds.has(model.id) &&
                (creditPlan === "pro" || getRequiredPlanToPickModel(model) === "free")
        })
    }, [availableModels, creditPlan, selectedModel, sharedModels])

    const storageKey = nudge ? getStorageKey(nudge) : null
    // biome-ignore lint/correctness/useExhaustiveDependencies: storageVersion forces a re-read after writes
    const storedState = useMemo(
        () => (storageKey ? readNudgeState(storageKey) : null),
        [storageKey, storageVersion]
    )

    const accept = useCallback(() => {
        if (!nudge || !storageKey) return
        setSelectedModel(nudge.replacement.id)
        writeNudgeState(storageKey, null)
        setStorageVersion((version) => version + 1)
    }, [nudge, setSelectedModel, storageKey])

    const dismiss = useCallback(() => {
        if (!storageKey) return
        writeNudgeState(storageKey, snoozeModelNudge(storedState, Date.now()))
        setStorageVersion((version) => version + 1)
    }, [storageKey, storedState])

    if (!nudge || isModelNudgeSnoozed(storedState, Date.now())) return null

    return {
        ...nudge,
        message: getModelNudgeMessage(nudge, storedState?.messageIndex ?? 0),
        accept,
        dismiss
    }
}
