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
    // The last write, held in state so the tab updates without re-reading storage. A version
    // counter in the memo deps doesn't work: React Compiler drops deps the body never reads.
    const [lastWrite, setLastWrite] = useState<{
        key: string
        state: ModelNudgeState | null
    } | null>(null)

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
    const storedState = useMemo(() => {
        if (!storageKey) return null
        return lastWrite?.key === storageKey ? lastWrite.state : readNudgeState(storageKey)
    }, [lastWrite, storageKey])

    const accept = useCallback(() => {
        if (!nudge || !storageKey) return
        setSelectedModel(nudge.replacement.id)
        writeNudgeState(storageKey, null)
        setLastWrite({ key: storageKey, state: null })
    }, [nudge, setSelectedModel, storageKey])

    const dismiss = useCallback(() => {
        if (!storageKey) return
        const state = snoozeModelNudge(storedState, Date.now())
        writeNudgeState(storageKey, state)
        setLastWrite({ key: storageKey, state })
    }, [storageKey, storedState])

    if (!nudge || isModelNudgeSnoozed(storedState, Date.now())) return null

    return {
        ...nudge,
        message: getModelNudgeMessage(nudge, storedState?.messageIndex ?? 0),
        accept,
        dismiss
    }
}
