import { ImageCostIndicator } from "@/components/image-cost-indicator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api } from "@/convex/_generated/api"
import type { SharedModel } from "@/convex/lib/models"
import { isModelSunset } from "@/convex/lib/models/lifecycle"
import { useSession, useToken } from "@/hooks/auth-hooks"
import {
    notifyModelReplacement,
    resolveAvailableModelReplacement
} from "@/hooks/use-model-lifecycle-migration"
import { useIsTouchDevice } from "@/hooks/use-touch-device"
import { resolveJwtToken } from "@/lib/auth-token"
import { browserEnv } from "@/lib/browser-env"
import { prepareChatAttachmentForUpload } from "@/lib/chat-attachments"
import {
    resolveDevCapOverride,
    resolveDevReferenceLimit,
    useAreDevOverridesActive,
    useDevOverridesStore
} from "@/lib/dev-overrides"
import { useShowContextualDevTools } from "@/lib/dev-tools"
import { uploadFileDirect } from "@/lib/direct-upload"
import { DEFAULT_UPLOAD_POLICY, formatFileSizeLimit } from "@/lib/file_constants"
import {
    SELECTABLE_IMAGE_ASPECT_RATIOS,
    type SelectableImageAspectRatio,
    getCommonSelectableImageAspectRatios
} from "@/lib/image-aspect-ratios"
import { getRequiredPlanToPickModel } from "@/lib/models-providers-shared"
import { useSharedModels } from "@/lib/shared-models"
import { cn } from "@/lib/utils"
import { useAction } from "convex/react"
import { ConvexError } from "convex/values"
import { AlertCircle, Archive, Loader2, Minus, Plus, Sparkles, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useGenerationStore } from "./generation-store"

const DEFAULT_VARIANTS_PER_MODEL = 1
const MAX_TOTAL_GENERATIONS_PER_RUN = 10
const MIN_POST_SUBMISSION_HOLD_MS = 1_000
const MAX_POST_SUBMISSION_HOLD_MS = 4_000
const LEGACY_IMAGE_MODEL_MIGRATION_KEY_PREFIX = "legacy-image-model-migrated"
const MIN_PROMPT_HEIGHT = 112
const MAX_PROMPT_VIEWPORT_RATIO = 0.4

export const getResizedLibraryPromptHeight = (
    startHeight: number,
    pointerDeltaY: number,
    maxHeight: number
) => Math.min(maxHeight, Math.max(MIN_PROMPT_HEIGHT, startHeight + pointerDeltaY))

// ConvexError carries the clean, user-facing message in `data`; plain action
// errors arrive wrapped in Convex's "[CONVEX A(...)] Server Error ..." banner.
const getGenerationErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof ConvexError && typeof error.data === "string") {
        return error.data
    }
    return fallback
}

const getModelMaxPerMessage = (model: SharedModel) =>
    model.maxPerMessage ?? DEFAULT_VARIANTS_PER_MODEL

const isLegacyImageModel = (model: SharedModel) => model.legacy === true

const getLegacyImageModelMigrationKey = (original: SharedModel, replacement: SharedModel) =>
    `${LEGACY_IMAGE_MODEL_MIGRATION_KEY_PREFIX}:${original.id}:${
        original.replacementId ?? "fallback"
    }:${replacement.id}`

const hasStoredLegacyImageModelMigration = (key: string) => {
    if (typeof window === "undefined") return false

    try {
        return window.localStorage.getItem(key) === "true"
    } catch {
        return false
    }
}

const storeLegacyImageModelMigration = (key: string) => {
    if (typeof window === "undefined") return

    try {
        window.localStorage.setItem(key, "true")
    } catch {}
}

const notifyLegacyImageModelReplacement = (original: SharedModel, replacement: SharedModel) => {
    toast.warning(
        `${original.name} is now a legacy image model. We selected ${replacement.name} instead, but you can still pick ${original.name} from legacy models.`
    )
}

const resolveLegacyImageModelReplacement = (
    original: SharedModel,
    candidateModels: readonly SharedModel[]
) => {
    const candidatesById = new Map(candidateModels.map((model) => [model.id, model]))
    const visited = new Set<string>()
    let current: SharedModel | undefined = original

    while (current?.replacementId && !visited.has(current.id)) {
        visited.add(current.id)
        const replacement = candidatesById.get(current.replacementId)
        if (!replacement) break
        if (!isLegacyImageModel(replacement)) return replacement
        current = replacement
    }

    return candidateModels.find((model) => model.id !== original.id && !isLegacyImageModel(model))
}

const clampModelCount = (model: SharedModel, count: number) =>
    Math.max(1, Math.min(count, getModelMaxPerMessage(model)))

const areStringArraysEqual = (left: string[], right: string[]) =>
    left.length === right.length && left.every((value, index) => value === right[index])

const areModelCountsEqual = (left: Record<string, number>, right: Record<string, number>) => {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)

    return leftKeys.length === rightKeys.length && leftKeys.every((key) => left[key] === right[key])
}

type ReferenceFile = {
    file: File
    preview: string
    hash?: string
    storageKey?: string
    error?: string
}

class ReferencePreparationError extends Error {}

const REFERENCE_INPUT_LIMIT_LABEL = formatFileSizeLimit(DEFAULT_UPLOAD_POLICY.maxFileSize)
const REFERENCE_PREPARATION_ERROR = `Reference could not be optimized to ${DEFAULT_UPLOAD_POLICY.maxImageDimension}px and under ${formatFileSizeLimit(DEFAULT_UPLOAD_POLICY.maxImageFileSize)}.`
const CREDIT_ACCESS_CACHE_MAX_AGE_MS = 5 * 60 * 1000
const CREDIT_ACCESS_RETRY_MS = 30 * 1000

type ImageGenerationCreditAccess = {
    userId: string
    plan: "free" | "pro"
    isStaff: boolean
    expiresAt: number
}

const getReferenceInputError = (file: File) =>
    file.size > DEFAULT_UPLOAD_POLICY.maxFileSize
        ? `References must be <${REFERENCE_INPUT_LIMIT_LABEL}.`
        : undefined

const getFileSha256 = async (file: File) => {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
    return Array.from(new Uint8Array(hashBuffer))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
}

export function ImageGenerationSidebar({
    disabled = false,
    shouldLoadCreditPlan = true
}: {
    disabled?: boolean
    shouldLoadCreditPlan?: boolean
}) {
    const { token } = useToken()
    const { data: session } = useSession()
    const creditAccessUserId = session?.user?.id ?? null
    const isTouchDevice = useIsTouchDevice()
    const { models } = useSharedModels()
    const imageModels = useMemo<SharedModel[]>(
        () => (models as SharedModel[]).filter((m) => m.mode === "image" && !isModelSunset(m)),
        [models]
    )
    const {
        addPendingGeneration,
        removePendingGeneration,
        prompt,
        setPrompt,
        selectedModelIds,
        setSelectedModelIds,
        selectedModelCounts,
        setSelectedModelCounts,
        aspectRatio,
        setAspectRatio,
        resolution,
        setResolution
    } = useGenerationStore()
    const isDevMode = useShowContextualDevTools()

    // Dev image-lab overrides. Values only take effect while dev overrides are active
    // (dev mode); GPT Image 2 quality is also available to staff in user mode.
    const overridesActive = useAreDevOverridesActive()
    const imageVariantMaxOverride = useDevOverridesStore((state) => state.imageVariantMax)
    const imageReferenceMaxOverride = useDevOverridesStore((state) => state.imageReferenceMax)
    const imageRunTotalMaxOverride = useDevOverridesStore((state) => state.imageRunTotalMax)
    const aspectRatioOverride = useDevOverridesStore((state) => state.aspectRatioOverride)
    const disableImageCompression = useDevOverridesStore((state) => state.disableImageCompression)
    const gptImage2Quality = useDevOverridesStore((state) => state.gptImage2Quality)
    const setImageVariantMax = useDevOverridesStore((state) => state.setImageVariantMax)
    const setImageReferenceMax = useDevOverridesStore((state) => state.setImageReferenceMax)
    const setImageRunTotalMax = useDevOverridesStore((state) => state.setImageRunTotalMax)
    const setAspectRatioOverride = useDevOverridesStore((state) => state.setAspectRatioOverride)
    const setDisableImageCompression = useDevOverridesStore(
        (state) => state.setDisableImageCompression
    )
    const setGptImage2Quality = useDevOverridesStore((state) => state.setGptImage2Quality)

    const resolveVariantMax = (model: SharedModel) =>
        resolveDevCapOverride(
            overridesActive,
            imageVariantMaxOverride,
            getModelMaxPerMessage(model),
            1
        )
    const effectiveRunTotalMax = resolveDevCapOverride(
        overridesActive,
        imageRunTotalMaxOverride,
        MAX_TOTAL_GENERATIONS_PER_RUN,
        1
    )
    const resolveModelReferenceLimit = (model: SharedModel | undefined) =>
        resolveDevReferenceLimit(
            overridesActive,
            imageReferenceMaxOverride,
            model?.maxReferenceImages
        )
    const effectiveAspectRatio =
        overridesActive && aspectRatioOverride ? aspectRatioOverride : aspectRatio

    const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([])
    const [showGradient, setShowGradient] = useState(false)
    const [fakeResponseTimeSeconds, setFakeResponseTimeSeconds] = useState(15)
    const [creditAccess, setCreditAccess] = useState<ImageGenerationCreditAccess | null>(null)
    const currentCreditAccess = creditAccess?.userId === creditAccessUserId ? creditAccess : null
    const creditPlan = currentCreditAccess?.plan ?? null
    const isStaff = currentCreditAccess?.isStaff ?? false
    const canSelectGptImage2Quality = isDevMode || isStaff
    const [expandedLegacyModels, setExpandedLegacyModels] = useState(false)
    const [promptHeight, setPromptHeight] = useState<number | null>(null)
    const [isResizingPrompt, setIsResizingPrompt] = useState(false)
    const [sessionRevealedLegacyModelIds, setSessionRevealedLegacyModelIds] = useState<Set<string>>(
        () => new Set()
    )
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const promptTextareaRef = useRef<HTMLTextAreaElement>(null)
    const promptResizeRef = useRef<{
        pointerId: number
        startY: number
        startHeight: number
        maxHeight: number
    } | null>(null)
    const referenceFilesRef = useRef(referenceFiles)
    const seenLegacyMigrationKeysRef = useRef<Set<string>>(new Set())
    const sessionRevealedLegacyModelIdsRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        if (!shouldLoadCreditPlan || !creditAccessUserId) {
            return
        }

        if (currentCreditAccess && currentCreditAccess.expiresAt > Date.now()) {
            const refreshTimeout = window.setTimeout(
                () =>
                    setCreditAccess((current) =>
                        current?.userId === creditAccessUserId
                            ? { ...current, expiresAt: 0 }
                            : current
                    ),
                currentCreditAccess.expiresAt - Date.now()
            )
            return () => window.clearTimeout(refreshTimeout)
        }

        let cancelled = false

        const loadCreditAccess = async () => {
            try {
                const response = await fetch("/api/credit-summary", {
                    credentials: "include"
                })
                if (!response.ok) {
                    throw new Error("Failed to load credit summary")
                }

                const data = (await response.json()) as {
                    plan?: "free" | "pro"
                    isStaff?: boolean
                }
                if (!cancelled) {
                    setCreditAccess({
                        userId: creditAccessUserId,
                        plan: data.plan === "pro" ? "pro" : "free",
                        isStaff: data.isStaff === true,
                        expiresAt: Date.now() + CREDIT_ACCESS_CACHE_MAX_AGE_MS
                    })
                }
            } catch {
                if (!cancelled) {
                    setCreditAccess({
                        userId: creditAccessUserId,
                        plan: "free",
                        isStaff: false,
                        expiresAt: Date.now() + CREDIT_ACCESS_RETRY_MS
                    })
                }
            }
        }

        void loadCreditAccess()

        return () => {
            cancelled = true
        }
    }, [creditAccessUserId, currentCreditAccess, shouldLoadCreditPlan])

    useEffect(() => {
        if (!isResizingPrompt) return

        const previousCursor = document.body.style.cursor
        const previousUserSelect = document.body.style.userSelect
        document.body.style.cursor = "ns-resize"
        document.body.style.userSelect = "none"

        return () => {
            document.body.style.cursor = previousCursor
            document.body.style.userSelect = previousUserSelect
        }
    }, [isResizingPrompt])

    const handlePromptResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (isTouchDevice || event.button !== 0) return

        const textarea = promptTextareaRef.current
        if (!textarea) return

        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        promptResizeRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startHeight: textarea.getBoundingClientRect().height,
            maxHeight: Math.max(
                MIN_PROMPT_HEIGHT,
                Math.floor(window.innerHeight * MAX_PROMPT_VIEWPORT_RATIO)
            )
        }
        setIsResizingPrompt(true)
    }

    const handlePromptResizeMove = (event: React.PointerEvent<HTMLButtonElement>) => {
        const resize = promptResizeRef.current
        if (!resize || resize.pointerId !== event.pointerId) return

        setPromptHeight(
            getResizedLibraryPromptHeight(
                resize.startHeight,
                event.clientY - resize.startY,
                resize.maxHeight
            )
        )
    }

    const handlePromptResizeEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
        const resize = promptResizeRef.current
        if (!resize || resize.pointerId !== event.pointerId) return

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
        }
        promptResizeRef.current = null
        setIsResizingPrompt(false)
    }

    const lockedModelIds = useMemo(
        () =>
            new Set(
                creditPlan === "free"
                    ? imageModels
                          .filter((model) => getRequiredPlanToPickModel(model) === "pro")
                          .map((model) => model.id)
                    : []
            ),
        [creditPlan, imageModels]
    )
    const selectableImageModels = useMemo(
        () => imageModels.filter((model) => !lockedModelIds.has(model.id)),
        [imageModels, lockedModelIds]
    )
    const selectedModels = useMemo(
        () => imageModels.filter((model) => selectedModelIds.includes(model.id)),
        [imageModels, selectedModelIds]
    )
    const selectedReferenceLimit = useMemo(() => {
        if (overridesActive && imageReferenceMaxOverride != null) {
            return Math.max(0, imageReferenceMaxOverride)
        }
        const limits = selectedModels
            .map((model) => model.maxReferenceImages)
            .filter((limit): limit is number => typeof limit === "number")
        if (limits.length === 0) return undefined
        return Math.min(...limits)
    }, [selectedModels, overridesActive, imageReferenceMaxOverride])

    useEffect(() => {
        referenceFilesRef.current = referenceFiles
    }, [referenceFiles])

    useEffect(() => {
        setSelectedModelIds((prev) => {
            const selectableModels = creditPlan === null ? imageModels : selectableImageModels
            const selectableIds = new Set(selectableModels.map((model) => model.id))
            const fallbackPool = selectableModels.length > 0 ? selectableModels : imageModels
            const validSelections = prev
                .map((id) => {
                    if (selectableIds.has(id)) return id

                    const original = models.find((model) => model.id === id)
                    if (!original || !isModelSunset(original)) return id

                    const replacement = resolveAvailableModelReplacement({
                        modelId: id,
                        sharedModels: models,
                        availableModels: selectableModels,
                        fallbackModelId: fallbackPool[0]?.id
                    })

                    if (replacement.replacementId && replacement.replacement) {
                        notifyModelReplacement(original, replacement.replacement)
                        return replacement.replacementId
                    }

                    return id
                })
                .filter(
                    (id, index, values) => selectableIds.has(id) && values.indexOf(id) === index
                )
            if (validSelections.length > 0) {
                return areStringArraysEqual(prev, validSelections) ? prev : validSelections
            }

            const fallbackSelection = fallbackPool.length > 0 ? [fallbackPool[0].id] : []
            return areStringArraysEqual(prev, fallbackSelection) ? prev : fallbackSelection
        })
    }, [creditPlan, imageModels, models, selectableImageModels, setSelectedModelIds])

    useEffect(() => {
        if (creditPlan === null || selectedModelIds.length === 0) return

        const candidateModels =
            selectableImageModels.length > 0 ? selectableImageModels : imageModels
        if (candidateModels.length === 0) return

        const imageModelsById = new Map(imageModels.map((model) => [model.id, model]))
        const migrations = selectedModelIds
            .map((modelId) => {
                const original = imageModelsById.get(modelId)
                if (!original || !isLegacyImageModel(original) || isModelSunset(original)) {
                    return null
                }
                if (
                    sessionRevealedLegacyModelIds.has(original.id) ||
                    sessionRevealedLegacyModelIdsRef.current.has(original.id)
                ) {
                    return null
                }

                const replacement = resolveLegacyImageModelReplacement(original, candidateModels)
                if (!replacement || replacement.id === original.id) {
                    return null
                }

                const storageKey = getLegacyImageModelMigrationKey(original, replacement)
                if (
                    seenLegacyMigrationKeysRef.current.has(storageKey) ||
                    hasStoredLegacyImageModelMigration(storageKey)
                ) {
                    return null
                }

                return { original, replacement, storageKey }
            })
            .filter(
                (
                    migration
                ): migration is {
                    original: SharedModel
                    replacement: SharedModel
                    storageKey: string
                } => migration !== null
            )

        if (migrations.length === 0) return

        const replacementByOriginalId = new Map(
            migrations.map((migration) => [migration.original.id, migration.replacement])
        )
        const nextSelectedModelIds = selectedModelIds
            .map((modelId) => replacementByOriginalId.get(modelId)?.id ?? modelId)
            .filter((modelId, index, values) => values.indexOf(modelId) === index)

        for (const migration of migrations) {
            seenLegacyMigrationKeysRef.current.add(migration.storageKey)
            storeLegacyImageModelMigration(migration.storageKey)
            notifyLegacyImageModelReplacement(migration.original, migration.replacement)
        }

        if (!areStringArraysEqual(selectedModelIds, nextSelectedModelIds)) {
            setSelectedModelIds(nextSelectedModelIds)
        }

        setSelectedModelCounts((prev) => {
            const nextCounts = { ...prev }
            let changed = false

            for (const migration of migrations) {
                const originalCount =
                    nextCounts[migration.original.id] ?? DEFAULT_VARIANTS_PER_MODEL
                delete nextCounts[migration.original.id]

                const replacementCount = nextCounts[migration.replacement.id] ?? 0
                const mergedCount = clampModelCount(
                    migration.replacement,
                    replacementCount + originalCount
                )

                if (nextCounts[migration.replacement.id] !== mergedCount) {
                    nextCounts[migration.replacement.id] = mergedCount
                    changed = true
                }

                if (migration.original.id in prev) {
                    changed = true
                }
            }

            return changed && !areModelCountsEqual(prev, nextCounts) ? nextCounts : prev
        })
    }, [
        creditPlan,
        imageModels,
        selectableImageModels,
        selectedModelIds,
        sessionRevealedLegacyModelIds,
        setSelectedModelCounts,
        setSelectedModelIds
    ])

    useEffect(() => {
        const overrideVariantMax =
            overridesActive && imageVariantMaxOverride != null
                ? Math.max(1, imageVariantMaxOverride)
                : null
        setSelectedModelCounts((prev) => {
            const validCounts = Object.fromEntries(
                Object.entries(prev)
                    .filter(([id]) => imageModels.some((model) => model.id === id))
                    .map(([id, count]) => {
                        const model = imageModels.find((candidate) => candidate.id === id)
                        const cap = overrideVariantMax ?? getModelMaxPerMessage(model!)
                        return [id, Math.max(1, Math.min(count, cap))]
                    })
            )

            if (Object.keys(validCounts).length > 0) {
                return areModelCountsEqual(prev, validCounts) ? prev : validCounts
            }

            const fallbackCounts =
                imageModels.length > 0 ? { [imageModels[0].id]: DEFAULT_VARIANTS_PER_MODEL } : {}
            return areModelCountsEqual(prev, fallbackCounts) ? prev : fallbackCounts
        })
    }, [imageModels, setSelectedModelCounts, overridesActive, imageVariantMaxOverride])

    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container
            const hasScrollableContent = scrollHeight > clientHeight
            const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 5
            setShowGradient(hasScrollableContent && !isScrolledToBottom)
        }

        handleScroll()
        container.addEventListener("scroll", handleScroll)

        const resizeObserver = new ResizeObserver(handleScroll)
        resizeObserver.observe(container)

        const mutationObserver = new MutationObserver(handleScroll)
        mutationObserver.observe(container, {
            childList: true,
            subtree: true
        })

        return () => {
            container.removeEventListener("scroll", handleScroll)
            resizeObserver.disconnect()
            mutationObserver.disconnect()
        }
    }, [])

    const generateImage = useAction(api.images_node.generateStandaloneImage)
    const generateFakeImage = useAction(api.images_node.generateFakeStandaloneImage)
    const [generationMode, setGenerationMode] = useState<"real" | "fake" | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const isGenerating = generationMode !== null

    useEffect(() => {
        return () => {
            for (const ref of referenceFilesRef.current) {
                URL.revokeObjectURL(ref.preview)
            }
        }
    }, [])

    const getAllowedReferenceFiles = (files: File[]) => {
        if (typeof selectedReferenceLimit !== "number") return files

        const remainingSlots = Math.max(0, selectedReferenceLimit - referenceFiles.length)
        if (files.length <= remainingSlots) return files

        toast.error(
            `The selected model set supports up to ${selectedReferenceLimit} reference images. Deselect limited models to add more.`
        )
        return files.slice(0, remainingSlots)
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (generationPanelDisabled || selectedRequiresPlanUpgrade) {
            if (fileInputRef.current) {
                fileInputRef.current.value = ""
            }
            return
        }

        if (!supportsReferenceImagesForSelection) {
            toast.error("Reference images are not supported for the selected model set")
            if (fileInputRef.current) {
                fileInputRef.current.value = ""
            }
            return
        }

        const files = Array.from(e.target.files || [])
        const allowedFiles = getAllowedReferenceFiles(files)
        if (allowedFiles.length > 0) {
            const newRefs = allowedFiles.map((file) => ({
                file,
                preview: URL.createObjectURL(file),
                error: getReferenceInputError(file)
            }))
            setReferenceFiles((prev) => [...prev, ...newRefs])
            if (newRefs.some((reference) => reference.error)) {
                toast.error(
                    `One or more reference images are larger than ${REFERENCE_INPUT_LIMIT_LABEL}. Choose a smaller image.`
                )
            }
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        if (generationPanelDisabled || selectedRequiresPlanUpgrade) {
            e.preventDefault()
            return
        }

        const items = Array.from(e.clipboardData.items)
        const imageItems = items.filter((item) => item.type.startsWith("image/"))

        if (imageItems.length > 0) {
            if (!supportsReferenceImagesForSelection) {
                e.preventDefault()
                toast.error("Reference images are not supported for the selected model set")
                return
            }

            e.preventDefault()
            const files = imageItems
                .map((item) => item.getAsFile())
                .filter((f): f is File => f !== null)
            const allowedFiles = getAllowedReferenceFiles(files)
            const newRefs = allowedFiles.map((file) => ({
                file,
                preview: URL.createObjectURL(file),
                error: getReferenceInputError(file)
            }))
            setReferenceFiles((prev) => [...prev, ...newRefs])
            if (newRefs.some((reference) => reference.error)) {
                toast.error(
                    `One or more reference images are larger than ${REFERENCE_INPUT_LIMIT_LABEL}. Choose a smaller image.`
                )
            }
        }
    }

    const removeReferenceImage = (index: number) => {
        setReferenceFiles((prev) => {
            const newArray = [...prev]
            URL.revokeObjectURL(newArray[index].preview)
            newArray.splice(index, 1)
            return newArray
        })
    }

    const toggleModel = (modelId: string) => {
        if (lockedModelIds.has(modelId)) {
            return
        }

        const isSelected = selectedModelIds.includes(modelId)
        const selectedModelReferenceLimit = resolveModelReferenceLimit(
            imageModels.find((model) => model.id === modelId)
        )
        if (
            !isSelected &&
            typeof selectedModelReferenceLimit === "number" &&
            referenceFiles.length > selectedModelReferenceLimit
        ) {
            toast.error(
                `This model supports up to ${selectedModelReferenceLimit} reference images. Remove references to select it.`
            )
            return
        }

        const toggledModel = imageModels.find((model) => model.id === modelId)
        if (toggledModel && isLegacyImageModel(toggledModel)) {
            sessionRevealedLegacyModelIdsRef.current.add(modelId)
            setSessionRevealedLegacyModelIds((prev) => {
                if (prev.has(modelId)) return prev
                const next = new Set(prev)
                next.add(modelId)
                return next
            })
        }

        if (isSelected && selectedModelIds.length === 1) {
            return
        }

        setSelectedModelIds((prev) =>
            isSelected ? prev.filter((id) => id !== modelId) : [...prev, modelId]
        )
        setSelectedModelCounts((prev) => {
            if (isSelected) {
                const next = { ...prev }
                delete next[modelId]
                return next
            }

            return {
                ...prev,
                [modelId]: DEFAULT_VARIANTS_PER_MODEL
            }
        })
    }

    const totalRequestedGenerations = useMemo(
        () =>
            selectedModelIds.reduce(
                (total, modelId) =>
                    total + (selectedModelCounts[modelId] ?? DEFAULT_VARIANTS_PER_MODEL),
                0
            ),
        [selectedModelCounts, selectedModelIds]
    )

    const updateModelCount = (modelId: string, nextCount: number) => {
        const model = imageModels.find((candidate) => candidate.id === modelId)
        if (!model) return

        const modelMax = resolveVariantMax(model)
        const clampedCount = Math.max(1, Math.min(nextCount, modelMax))
        const currentCount = selectedModelCounts[modelId] ?? DEFAULT_VARIANTS_PER_MODEL
        const nextTotal = totalRequestedGenerations - currentCount + clampedCount

        if (nextTotal > effectiveRunTotalMax) {
            toast.error(`You can generate up to ${effectiveRunTotalMax} images per run`)
            return
        }

        setSelectedModelCounts((prev) => ({
            ...prev,
            [modelId]: clampedCount
        }))
    }

    const collapsedVisibleLegacyModelIds = useMemo(() => {
        const visibleLegacyModelIds = new Set(sessionRevealedLegacyModelIds)
        for (const modelId of selectedModelIds) {
            const model = imageModels.find((candidate) => candidate.id === modelId)
            if (model && isLegacyImageModel(model)) {
                visibleLegacyModelIds.add(modelId)
            }
        }

        return new Set(
            imageModels
                .filter((model) => isLegacyImageModel(model) && visibleLegacyModelIds.has(model.id))
                .map((model) => model.id)
        )
    }, [imageModels, selectedModelIds, sessionRevealedLegacyModelIds])
    const visibleImageModels = useMemo(() => {
        const currentModels = imageModels.filter((model) => !isLegacyImageModel(model))
        const legacyModels = imageModels.filter((model) => isLegacyImageModel(model))
        const visibleLegacyModels = expandedLegacyModels
            ? legacyModels
            : legacyModels.filter((model) => collapsedVisibleLegacyModelIds.has(model.id))

        return [...currentModels, ...visibleLegacyModels]
    }, [collapsedVisibleLegacyModelIds, expandedLegacyModels, imageModels])
    const hiddenLegacyModelCount = useMemo(() => {
        if (expandedLegacyModels) return 0

        return imageModels.filter(
            (model) => isLegacyImageModel(model) && !collapsedVisibleLegacyModelIds.has(model.id)
        ).length
    }, [collapsedVisibleLegacyModelIds, expandedLegacyModels, imageModels])
    const visibleSelectedOrRevealedLegacyCount = collapsedVisibleLegacyModelIds.size

    const commonImageSizes = useMemo<SelectableImageAspectRatio[]>(() => {
        if (selectedModels.length === 0) return []

        return getCommonSelectableImageAspectRatios(
            selectedModels.map((model) => model.supportedImageSizes)
        )
    }, [selectedModels])

    useEffect(() => {
        // A manual aspect-ratio override pins whatever the dev typed; skip the reset.
        if (overridesActive && aspectRatioOverride) return
        if (
            commonImageSizes.length > 0 &&
            !commonImageSizes.includes(aspectRatio as SelectableImageAspectRatio)
        ) {
            setAspectRatio(commonImageSizes[0])
        }
    }, [commonImageSizes, aspectRatio, setAspectRatio, overridesActive, aspectRatioOverride])

    const commonImageResolutions = useMemo(() => {
        if (selectedModels.length === 0) return ["1K"]

        const allSupport = selectedModels.every(
            (m) => m.supportedImageResolutions && m.supportedImageResolutions.length > 0
        )

        if (!allSupport) {
            return ["1K"]
        }

        let intersection = ["1K", "2K", "4K"]
        for (const model of selectedModels) {
            if (model.supportedImageResolutions) {
                intersection = intersection.filter((res) =>
                    model.supportedImageResolutions!.includes(res as "1K" | "2K" | "4K")
                )
            }
        }

        return intersection.length > 0 ? intersection : ["1K"]
    }, [selectedModels])

    useEffect(() => {
        if (commonImageResolutions.length > 0 && !commonImageResolutions.includes(resolution)) {
            setResolution(commonImageResolutions[0] || "1K")
        }
    }, [commonImageResolutions, resolution, setResolution])

    const selectedRequiresPlanUpgrade = useMemo(
        () => selectedModels.some((model) => lockedModelIds.has(model.id)),
        [lockedModelIds, selectedModels]
    )
    const generationPlanLocked =
        creditPlan === "free" && imageModels.length > 0 && selectableImageModels.length === 0
    const generationPanelDisabled = disabled || generationPlanLocked

    const supportsReferenceImagesForSelection = useMemo(
        () =>
            selectedModels.length > 0 &&
            selectedModels.every((model) => model.supportsReferenceImages === true),
        [selectedModels]
    )
    const hasSingleReferenceXaiEdit = useMemo(
        () =>
            referenceFiles.length === 1 &&
            selectedModels.some((model) => model.customIcon === "xai"),
        [referenceFiles.length, selectedModels]
    )

    const canGenerateBase =
        selectedModelIds.length > 0 && !isGenerating && commonImageSizes.length > 0
    const normalizedPrompt = prompt.trim()
    const canSubmitGeneration =
        canGenerateBase &&
        Boolean(normalizedPrompt) &&
        !generationPanelDisabled &&
        !selectedRequiresPlanUpgrade

    const uploadReferenceKeys = async () => {
        const currentReferences = referenceFilesRef.current
        if (currentReferences.length === 0) {
            return []
        }

        setReferenceFiles((prev) => prev.map((reference) => ({ ...reference, error: undefined })))

        const oversizedReferences = currentReferences.filter((reference) =>
            getReferenceInputError(reference.file)
        )
        if (oversizedReferences.length > 0) {
            const oversizedPreviews = new Set(
                oversizedReferences.map((reference) => reference.preview)
            )
            setReferenceFiles((prev) =>
                prev.map((reference) =>
                    oversizedPreviews.has(reference.preview)
                        ? { ...reference, error: getReferenceInputError(reference.file) }
                        : reference
                )
            )
            throw new ReferencePreparationError(
                `One or more reference images are larger than ${REFERENCE_INPUT_LIMIT_LABEL}. Choose a smaller image.`
            )
        }

        const hashToStorageKey = new Map<string, string>()
        for (const reference of currentReferences) {
            if (reference.hash && reference.storageKey) {
                hashToStorageKey.set(reference.hash, reference.storageKey)
            }
        }

        const uploadedKeys: string[] = []

        for (const reference of currentReferences) {
            let preparedFile: File
            try {
                preparedFile = await prepareChatAttachmentForUpload(reference.file, undefined, {
                    skipImageCompression: overridesActive && disableImageCompression
                })
            } catch {
                setReferenceFiles((prev) =>
                    prev.map((item) =>
                        item.preview === reference.preview
                            ? { ...item, error: REFERENCE_PREPARATION_ERROR }
                            : item
                    )
                )
                throw new ReferencePreparationError(
                    "One or more references could not be optimized. Try a smaller image."
                )
            }
            const hash = reference.hash ?? (await getFileSha256(preparedFile))
            const existingKey = reference.storageKey ?? hashToStorageKey.get(hash)

            if (existingKey) {
                hashToStorageKey.set(hash, existingKey)
                uploadedKeys.push(existingKey)
                setReferenceFiles((prev) =>
                    prev.map((item) =>
                        item.preview === reference.preview
                            ? { ...item, hash, storageKey: existingKey }
                            : item
                    )
                )
                continue
            }

            const jwt = await resolveJwtToken(token)
            if (!jwt) {
                throw new Error("Authentication token unavailable")
            }

            const uploaded = await uploadFileDirect({
                file: preparedFile,
                jwt,
                uploadBaseUrl: `${browserEnv("VITE_CONVEX_API_URL")}/upload`,
                purpose: "reference"
            })

            hashToStorageKey.set(hash, uploaded.key)
            uploadedKeys.push(uploaded.key)
            setReferenceFiles((prev) =>
                prev.map((item) =>
                    item.preview === reference.preview
                        ? { ...item, hash, storageKey: uploaded.key }
                        : item
                )
            )
        }

        return uploadedKeys
    }

    const handleGenerate = async () => {
        if (generationPanelDisabled || selectedRequiresPlanUpgrade) return
        if (!normalizedPrompt || selectedModelIds.length === 0) return
        if (referenceFiles.length > 0 && !supportsReferenceImagesForSelection) {
            toast.error("Reference images are not supported for the selected model set")
            return
        }

        setGenerationMode("real")
        try {
            const uploadedReferenceKeys = await uploadReferenceKeys()

            const results = await Promise.allSettled(
                selectedModelIds
                    .flatMap((modelId) => {
                        const model = imageModels.find((m) => m.id === modelId)
                        const supportsResolution =
                            model?.supportedImageResolutions &&
                            model.supportedImageResolutions.length > 0
                        const count = selectedModelCounts[modelId] ?? DEFAULT_VARIANTS_PER_MODEL

                        return Array.from({ length: count }, () => async () => {
                            const id = Math.random().toString(36).substring(2, 11)
                            await generateImage({
                                prompt: normalizedPrompt,
                                modelId,
                                clientRequestId: id,
                                aspectRatio: effectiveAspectRatio,
                                referenceImageIds: uploadedReferenceKeys,
                                ...(canSelectGptImage2Quality && modelId === "gpt-5.4-image-2"
                                    ? { quality: gptImage2Quality }
                                    : {}),
                                ...(supportsResolution ? { resolution } : {})
                            })
                        })
                    })
                    .map((runGeneration) => runGeneration())
            )

            const failedResult = results.find(
                (result): result is PromiseRejectedResult => result.status === "rejected"
            )
            if (failedResult) {
                throw failedResult.reason
            }

            // Give the reactive job query time to replace submission feedback with the
            // persisted generation tiles. Larger batches can take slightly longer to sync.
            const postSubmissionHoldMs = Math.min(
                MAX_POST_SUBMISSION_HOLD_MS,
                Math.max(MIN_POST_SUBMISSION_HOLD_MS, totalRequestedGenerations * 1_000)
            )
            await new Promise((resolve) => window.setTimeout(resolve, postSubmissionHoldMs))
        } catch (error) {
            console.error("Failed to generate image:", error)
            toast.error(
                error instanceof ReferencePreparationError
                    ? error.message
                    : getGenerationErrorMessage(error, "Failed to generate image")
            )
        } finally {
            setGenerationMode(null)
        }
    }

    const handleFakeGenerate = async () => {
        if (generationPanelDisabled || selectedRequiresPlanUpgrade) return
        if (!isDevMode || !normalizedPrompt || selectedModelIds.length === 0) return
        if (referenceFiles.length > 0 && !supportsReferenceImagesForSelection) {
            toast.error("Reference images are not supported for the selected model set")
            return
        }

        setGenerationMode("fake")
        try {
            const uploadedReferenceKeys = await uploadReferenceKeys()
            const results = await Promise.allSettled(
                selectedModelIds
                    .flatMap((modelId) => {
                        const model = imageModels.find((m) => m.id === modelId)
                        const supportsResolution =
                            model?.supportedImageResolutions &&
                            model.supportedImageResolutions.length > 0
                        const count = selectedModelCounts[modelId] ?? DEFAULT_VARIANTS_PER_MODEL

                        return Array.from({ length: count }, (_, index) => async () => {
                            const id = Math.random().toString(36).substring(2, 11)
                            addPendingGeneration({ id, aspectRatio: effectiveAspectRatio })

                            try {
                                await generateFakeImage({
                                    prompt: normalizedPrompt,
                                    modelId,
                                    aspectRatio: effectiveAspectRatio,
                                    variantIndex: index + 1,
                                    referenceImageIds: uploadedReferenceKeys,
                                    responseTimeSeconds: fakeResponseTimeSeconds,
                                    ...(supportsResolution ? { resolution } : {})
                                })
                            } finally {
                                removePendingGeneration(id)
                            }
                        })
                    })
                    .map((runGeneration) => runGeneration())
            )

            const failedResult = results.find(
                (result): result is PromiseRejectedResult => result.status === "rejected"
            )
            if (failedResult) {
                throw failedResult.reason
            }
        } catch (error) {
            console.error("Failed to run fake image generation:", error)
            toast.error(
                error instanceof ReferencePreparationError
                    ? error.message
                    : getGenerationErrorMessage(error, "Failed to run fake image generation")
            )
        } finally {
            setGenerationMode(null)
        }
    }

    return (
        <div className="custom-scrollbar relative flex h-full w-full flex-col text-foreground text-sm">
            <fieldset
                disabled={generationPanelDisabled}
                className={cn(
                    "flex h-full w-full min-w-0 flex-col",
                    generationPanelDisabled && "opacity-50 blur-sm"
                )}
            >
                {/* Prompt Section */}
                <div className="space-y-3 border-b p-4">
                    <div className="flex items-center gap-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                        <Sparkles className="h-3.5 w-3.5" /> PROMPT
                    </div>
                    <div className="overflow-hidden rounded-md bg-muted/30 focus-within:ring-1 focus-within:ring-primary/30">
                        <Textarea
                            ref={promptTextareaRef}
                            placeholder="Describe your image..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onPaste={handlePaste}
                            style={promptHeight === null ? undefined : { height: promptHeight }}
                            className="field-sizing-fixed max-h-[40dvh] min-h-[7rem] resize-none overflow-y-auto rounded-none border-0 bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
                        />
                        {!isTouchDevice ? (
                            <button
                                type="button"
                                aria-label="Resize prompt vertically"
                                onPointerDown={handlePromptResizeStart}
                                onPointerMove={handlePromptResizeMove}
                                onPointerUp={handlePromptResizeEnd}
                                onPointerCancel={handlePromptResizeEnd}
                                className="group flex h-4 w-full cursor-ns-resize touch-none items-center justify-center"
                            >
                                <span
                                    className={cn(
                                        "h-0.5 w-8 rounded-[var(--radius-sm)] bg-muted-foreground/25 transition-colors group-hover:bg-muted-foreground/60 group-focus-visible:bg-muted-foreground/60",
                                        isResizingPrompt && "bg-muted-foreground/60"
                                    )}
                                />
                            </button>
                        ) : null}
                    </div>
                </div>

                {/* References Section */}
                <div className="space-y-3 border-b p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                            <svg
                                className="h-3.5 w-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                            </svg>
                            REFERENCES
                        </div>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={
                                !supportsReferenceImagesForSelection || selectedRequiresPlanUpgrade
                            }
                            className="text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>

                    {!supportsReferenceImagesForSelection && (
                        <p className="text-[0.6875rem] text-muted-foreground">
                            Reference images are unavailable for the current model selection.
                        </p>
                    )}

                    {referenceFiles.length > 0 && (
                        <div className="custom-scrollbar flex gap-2 overflow-x-auto pb-1">
                            {referenceFiles.map((ref, index) => (
                                <div
                                    key={index}
                                    className={cn(
                                        "relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-background",
                                        ref.error && "ring-2 ring-destructive/70"
                                    )}
                                >
                                    <img
                                        src={ref.preview}
                                        className="h-full w-full object-cover"
                                        alt="ref"
                                    />
                                    {ref.error && (
                                        <Tooltip delayDuration={150}>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="absolute bottom-1 left-1 rounded-[var(--radius-sm)] border border-destructive/40 bg-background/90 p-0.5 text-destructive"
                                                    aria-label={ref.error}
                                                >
                                                    <AlertCircle
                                                        className="h-3.5 w-3.5"
                                                        aria-hidden="true"
                                                    />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom">
                                                {ref.error}
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                    <button
                                        type="button"
                                        className="absolute top-1 right-1 rounded-full bg-background/50 p-0.5 text-foreground transition-colors hover:bg-background/80"
                                        onClick={() => removeReferenceImage(index)}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileChange}
                    />
                </div>

                <div className="relative flex min-h-0 flex-1 flex-col">
                    <div ref={scrollContainerRef} className="scrollbar-hide flex-1 overflow-y-auto">
                        {/* Input Section */}
                        <div className="space-y-3 border-b p-4">
                            <div className="flex items-center justify-between font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                                <div className="flex items-center gap-2">
                                    <svg
                                        className="h-3.5 w-3.5"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                    </svg>
                                    MODELS
                                </div>
                                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[0.625rem] text-primary">
                                    {selectedModelIds.length} active • {totalRequestedGenerations}{" "}
                                    outputs
                                </span>
                            </div>

                            <div className="flex flex-col space-y-1">
                                {visibleImageModels.map((model, modelIndex) => {
                                    const isSelected = selectedModelIds.includes(model.id)
                                    const modelPlanLocked = lockedModelIds.has(model.id)
                                    const modelReferenceLimit = resolveModelReferenceLimit(model)
                                    const modelReferenceLocked =
                                        !isSelected &&
                                        typeof modelReferenceLimit === "number" &&
                                        referenceFiles.length > modelReferenceLimit
                                    const modelDisabled = modelPlanLocked || modelReferenceLocked
                                    const isLegacyModel = isLegacyImageModel(model)
                                    const startsExpandedLegacyModels =
                                        expandedLegacyModels &&
                                        isLegacyModel &&
                                        (modelIndex === 0 ||
                                            !isLegacyImageModel(visibleImageModels[modelIndex - 1]))
                                    const modelCount =
                                        selectedModelCounts[model.id] ?? DEFAULT_VARIANTS_PER_MODEL
                                    const modelMaxPerMessage = resolveVariantMax(model)
                                    const canIncrement =
                                        isSelected &&
                                        modelCount < modelMaxPerMessage &&
                                        totalRequestedGenerations < effectiveRunTotalMax
                                    const modelElement = (
                                        <div
                                            key={model.id}
                                            className={cn(
                                                "group rounded-md p-2 transition-all duration-200",
                                                modelDisabled && "cursor-not-allowed opacity-50",
                                                isSelected
                                                    ? "bg-primary/15 text-primary"
                                                    : "text-muted-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleModel(model.id)}
                                                disabled={modelDisabled}
                                                className="flex w-full items-center justify-between gap-2 p-1 text-left disabled:cursor-not-allowed"
                                            >
                                                <div className="flex min-w-0 max-w-[calc(100%-1.5rem)] flex-1 flex-col">
                                                    <div className="flex min-w-0 items-center gap-1.5">
                                                        <span
                                                            className={cn(
                                                                "truncate font-medium",
                                                                isSelected ? "text-foreground" : ""
                                                            )}
                                                        >
                                                            {model.name}
                                                        </span>
                                                        <ImageCostIndicator
                                                            model={model}
                                                            aspectRatio={effectiveAspectRatio}
                                                            resolution={resolution}
                                                            quality={
                                                                canSelectGptImage2Quality &&
                                                                model.id === "gpt-5.4-image-2"
                                                                    ? gptImage2Quality
                                                                    : undefined
                                                            }
                                                            variants={modelCount}
                                                            referenceCount={referenceFiles.length}
                                                        />
                                                    </div>
                                                    <span className="mt-0.5 text-[0.625rem] opacity-70">
                                                        {modelPlanLocked
                                                            ? "Pro plan required"
                                                            : modelReferenceLocked
                                                              ? `Max ${modelReferenceLimit} references`
                                                              : `${
                                                                    isLegacyModel ? "Legacy • " : ""
                                                                }Up to ${modelMaxPerMessage} per run`}
                                                    </span>
                                                </div>

                                                <div
                                                    className={cn(
                                                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                                                        isSelected
                                                            ? "border-primary bg-primary"
                                                            : "border-muted-foreground/30 group-hover:border-muted-foreground/50"
                                                    )}
                                                >
                                                    {isSelected && (
                                                        <svg
                                                            className="h-2.5 w-2.5 text-primary-foreground"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="3"
                                                        >
                                                            <polyline points="20 6 9 17 4 12" />
                                                        </svg>
                                                    )}
                                                </div>
                                            </button>

                                            {isSelected && (
                                                <div className="mt-2 space-y-1">
                                                    <div className="flex items-center justify-between rounded-md border border-primary/10 bg-background/40 px-2 py-1.5">
                                                        <span className="text-[0.625rem] uppercase tracking-wider opacity-70">
                                                            Variants
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    updateModelCount(
                                                                        model.id,
                                                                        modelCount - 1
                                                                    )
                                                                }
                                                                disabled={
                                                                    modelPlanLocked ||
                                                                    modelCount <= 1
                                                                }
                                                                className="flex h-6 w-6 items-center justify-center rounded border border-border/60 text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                                                            >
                                                                <Minus className="h-3 w-3" />
                                                            </button>
                                                            <span className="min-w-8 text-center font-medium text-foreground text-xs">
                                                                {modelCount}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    updateModelCount(
                                                                        model.id,
                                                                        modelCount + 1
                                                                    )
                                                                }
                                                                disabled={
                                                                    modelPlanLocked || !canIncrement
                                                                }
                                                                className="flex h-6 w-6 items-center justify-center rounded border border-border/60 text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {canSelectGptImage2Quality &&
                                                        model.id === "gpt-5.4-image-2" && (
                                                            <div className="flex items-center justify-between rounded-md border border-primary/10 bg-background/40 px-2 py-1.5">
                                                                <span className="text-[0.625rem] uppercase tracking-wider opacity-70">
                                                                    Quality
                                                                </span>
                                                                <Tabs
                                                                    value={gptImage2Quality}
                                                                    onValueChange={(value) => {
                                                                        if (
                                                                            value === "low" ||
                                                                            value === "medium" ||
                                                                            value === "high"
                                                                        ) {
                                                                            setGptImage2Quality(
                                                                                value
                                                                            )
                                                                        }
                                                                    }}
                                                                >
                                                                    <TabsList
                                                                        className="h-7"
                                                                        aria-label="GPT Image 2 quality"
                                                                    >
                                                                        {(
                                                                            [
                                                                                "low",
                                                                                "medium",
                                                                                "high"
                                                                            ] as const
                                                                        ).map((quality) => (
                                                                            <TabsTrigger
                                                                                key={quality}
                                                                                value={quality}
                                                                                className="px-2 text-[0.625rem] capitalize"
                                                                            >
                                                                                {quality}
                                                                            </TabsTrigger>
                                                                        ))}
                                                                    </TabsList>
                                                                </Tabs>
                                                            </div>
                                                        )}
                                                </div>
                                            )}
                                        </div>
                                    )

                                    if (!startsExpandedLegacyModels) return modelElement

                                    return [
                                        <div
                                            key="legacy-model-controls"
                                            className="flex items-center justify-between px-2 pt-1"
                                        >
                                            <div className="flex items-center gap-2 font-semibold text-muted-foreground text-xs tracking-wider">
                                                <Archive className="h-3.5 w-3.5" />
                                                LEGACY
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                aria-label="Hide legacy models"
                                                className="h-7 px-2 text-muted-foreground text-xs hover:text-foreground"
                                                onClick={() => setExpandedLegacyModels(false)}
                                            >
                                                Hide
                                            </Button>
                                        </div>,
                                        modelElement
                                    ]
                                })}
                                {hiddenLegacyModelCount > 0 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="mt-1 h-9 w-full justify-center gap-2 text-muted-foreground text-xs hover:text-foreground"
                                        onClick={() => setExpandedLegacyModels(true)}
                                    >
                                        <Archive className="h-3.5 w-3.5" />
                                        {visibleSelectedOrRevealedLegacyCount > 0
                                            ? "Show more legacy models"
                                            : "Show legacy models"}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Aspect Ratio Section */}
                        <div className="space-y-4 p-4">
                            <div className="flex items-center gap-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                                <svg
                                    className="h-3.5 w-3.5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                </svg>
                                ASPECT RATIO
                            </div>

                            <div className="custom-scrollbar flex gap-2 overflow-x-auto pb-2">
                                {SELECTABLE_IMAGE_ASPECT_RATIOS.map((size) => {
                                    const isAvailable = commonImageSizes.includes(size)
                                    const isSelected = aspectRatio === size
                                    const [wStr, hStr] = size.split(":")
                                    const w = Number.parseInt(wStr) || 1
                                    const h = Number.parseInt(hStr) || 1

                                    return (
                                        <button
                                            type="button"
                                            key={size}
                                            onClick={() => isAvailable && setAspectRatio(size)}
                                            disabled={!isAvailable}
                                            className={cn(
                                                "flex min-w-[2.25rem] shrink-0 flex-col items-center gap-1.5 rounded-md p-2 transition-all",
                                                !isAvailable && "cursor-not-allowed opacity-30",
                                                isSelected && isAvailable
                                                    ? "bg-primary/15 text-primary"
                                                    : "text-muted-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            <div className="flex h-5 items-center justify-center">
                                                <div
                                                    className={cn(
                                                        "rounded-[2px] border-2",
                                                        isSelected
                                                            ? "border-primary"
                                                            : "border-muted-foreground/50"
                                                    )}
                                                    style={{
                                                        width:
                                                            w >= h
                                                                ? "18px"
                                                                : `${Math.max(10, 18 * (w / h))}px`,
                                                        height:
                                                            h >= w
                                                                ? "18px"
                                                                : `${Math.max(10, 18 * (h / w))}px`
                                                    }}
                                                />
                                            </div>
                                            <span
                                                className={cn(
                                                    "font-medium text-[0.5625rem]",
                                                    isSelected ? "text-foreground" : ""
                                                )}
                                            >
                                                {size}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                            {hasSingleReferenceXaiEdit && (
                                <p className="text-[0.6875rem] text-muted-foreground leading-relaxed">
                                    xAI single-image edits keep the input image's aspect ratio. The
                                    aspect ratio picker only reliably applies to text-to-image and
                                    multi-image edits.
                                </p>
                            )}
                        </div>

                        {/* Resolution Section */}
                        <div className="space-y-4 p-4 pt-0">
                            <div className="flex items-center gap-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                                <svg
                                    className="h-3.5 w-3.5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                    <line x1="12" y1="22.08" x2="12" y2="12" />
                                </svg>
                                RESOLUTION
                            </div>

                            <div className="custom-scrollbar flex gap-2 overflow-x-auto pb-2">
                                {["1K", "2K", "4K"].map((res) => {
                                    const isAvailable = commonImageResolutions.includes(res)
                                    const isSelected = resolution === res

                                    return (
                                        <button
                                            type="button"
                                            key={res}
                                            onClick={() => isAvailable && setResolution(res)}
                                            disabled={!isAvailable}
                                            className={cn(
                                                "flex min-w-[3.75rem] flex-1 shrink-0 flex-col items-center justify-center rounded-md p-2 transition-all",
                                                !isAvailable && "cursor-not-allowed opacity-30",
                                                isSelected && isAvailable
                                                    ? "border border-primary/20 bg-primary/15 text-primary"
                                                    : "border border-transparent text-muted-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "font-medium text-xs",
                                                    isSelected ? "text-foreground" : ""
                                                )}
                                            >
                                                {res.toLowerCase()}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                    <div
                        className={cn(
                            "pointer-events-none absolute right-0 bottom-0 left-0 h-20 bg-gradient-to-t from-sidebar via-sidebar/60 to-transparent transition-opacity duration-300",
                            showGradient ? "opacity-100" : "opacity-0"
                        )}
                    />
                </div>

                {/* Bottom Generate Button */}
                <div className="sticky bottom-0 z-10 border-t bg-sidebar p-4">
                    {isDevMode && (
                        <div className="mb-3 space-y-2 rounded-md border border-border/60 bg-background/50 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <span className="font-medium text-[0.6875rem] text-muted-foreground uppercase tracking-wider">
                                    Image Lab Overrides
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 rounded-[var(--radius-sm)] px-2 text-[0.625rem]"
                                    onClick={() => {
                                        setImageVariantMax(null)
                                        setImageRunTotalMax(null)
                                        setImageReferenceMax(null)
                                        setAspectRatioOverride(null)
                                        setDisableImageCompression(false)
                                        setGptImage2Quality("low")
                                    }}
                                >
                                    Reset
                                </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <ImageOverrideNumber
                                    label="Variant max"
                                    value={imageVariantMaxOverride}
                                    min={1}
                                    onChange={setImageVariantMax}
                                />
                                <ImageOverrideNumber
                                    label="Run total"
                                    value={imageRunTotalMaxOverride}
                                    min={1}
                                    onChange={setImageRunTotalMax}
                                />
                                <ImageOverrideNumber
                                    label="Ref max"
                                    value={imageReferenceMaxOverride}
                                    min={0}
                                    onChange={setImageReferenceMax}
                                />
                            </div>
                            <div className="space-y-1">
                                <span className="text-[0.625rem] text-muted-foreground">
                                    Aspect ratio (blank = auto)
                                </span>
                                <Input
                                    value={aspectRatioOverride ?? ""}
                                    placeholder="e.g. 21:9"
                                    className="h-8 rounded-[var(--radius-sm)] text-xs"
                                    onChange={(event) =>
                                        setAspectRatioOverride(
                                            event.target.value.trim() === ""
                                                ? null
                                                : event.target.value.trim()
                                        )
                                    }
                                />
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground text-xs">
                                    Skip image compression
                                </span>
                                <Switch
                                    checked={disableImageCompression}
                                    onCheckedChange={setDisableImageCompression}
                                />
                            </div>
                        </div>
                    )}
                    {isDevMode && (
                        <div className="mb-3 rounded-md border border-border/60 bg-background/50 p-3">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <span className="font-medium text-[0.6875rem] text-muted-foreground uppercase tracking-wider">
                                    Time To Respond
                                </span>
                                <span className="font-medium text-foreground text-sm">
                                    {fakeResponseTimeSeconds}s
                                </span>
                            </div>
                            <Slider
                                value={[fakeResponseTimeSeconds]}
                                min={5}
                                max={90}
                                step={1}
                                disabled={isGenerating}
                                onValueChange={(value) => {
                                    const nextValue = value[0]
                                    if (typeof nextValue === "number") {
                                        setFakeResponseTimeSeconds(nextValue)
                                    }
                                }}
                            />
                            <div className="mt-2 flex items-center justify-between text-[0.625rem] text-muted-foreground">
                                <span>5s min</span>
                                <span>90s max</span>
                            </div>
                        </div>
                    )}
                    {isDevMode && (
                        <Button
                            onClick={handleFakeGenerate}
                            disabled={!canSubmitGeneration}
                            variant="outline"
                            className="mb-2 flex h-11 w-full items-center justify-center gap-2 rounded-md border-border border-dashed bg-background font-medium hover:bg-muted/50"
                        >
                            {generationMode === "fake" ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Fake Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                                    {totalRequestedGenerations > 1
                                        ? `Fake Generation (${totalRequestedGenerations})`
                                        : "Fake Generation"}
                                </>
                            )}
                        </Button>
                    )}
                    <Button
                        onClick={handleGenerate}
                        disabled={disabled || !canSubmitGeneration}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-secondary font-medium text-secondary-foreground hover:bg-secondary/80"
                    >
                        {generationMode === "real" ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4 text-muted-foreground" />
                                {totalRequestedGenerations > 1
                                    ? `Generate ${totalRequestedGenerations} Images`
                                    : "Generate"}
                            </>
                        )}
                    </Button>
                </div>
            </fieldset>
            <div
                aria-hidden={!generationPanelDisabled}
                className={cn(
                    "absolute inset-0 z-20 flex items-center justify-center bg-sidebar/85 p-6 text-center transition-none",
                    generationPanelDisabled
                        ? "pointer-events-auto opacity-100"
                        : "pointer-events-none opacity-0"
                )}
            >
                <div className="max-w-xs rounded-[var(--radius-lg)] border border-border/60 bg-background/90 p-4 shadow-lg">
                    <p className="font-medium text-sm">
                        {disabled ? "Image generation unavailable" : "Upgrade to Pro"}
                    </p>
                    <p className="mt-1 text-muted-foreground text-xs leading-5">
                        {disabled
                            ? "You cannot generate images in the Archive view. Switch to the Library view to continue generating images."
                            : "Free users may view their image library, but creating new images requires a Pro plan."}
                    </p>
                </div>
            </div>
        </div>
    )
}

function ImageOverrideNumber({
    label,
    value,
    min,
    onChange
}: {
    label: string
    value: number | null
    min: number
    onChange: (value: number | null) => void
}) {
    return (
        <div className="space-y-1">
            <span className="text-[0.625rem] text-muted-foreground">{label}</span>
            <Input
                type="number"
                min={min}
                value={value ?? ""}
                placeholder="def"
                aria-label={label}
                className="h-8 rounded-[var(--radius-sm)] text-xs"
                onChange={(event) => {
                    const raw = event.target.value.trim()
                    if (raw === "") {
                        onChange(null)
                        return
                    }
                    const parsed = Number.parseInt(raw, 10)
                    onChange(Number.isNaN(parsed) ? null : Math.max(min, parsed))
                }}
            />
        </div>
    )
}
