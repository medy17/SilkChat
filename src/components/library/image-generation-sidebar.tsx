import { AttachmentTile } from "@/components/attachment-tile"
import { AttachmentAction } from "@/components/composer/attachment-actions"
import { AnimatedCollapsible } from "@/components/ui/animated-collapsible"
import { ImageCostIndicator } from "@/components/image-cost-indicator"
import { SPOTLIGHT_CARD_CLASS } from "@/components/renderers/spotlight-frame"
import { useCreditAccess } from "@/components/credits/credit-access-runtime"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import type { ImageQuality, ImageReasoningEffort, SharedModel } from "@/convex/lib/models"
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
    getCommonSelectableImageAspectRatios,
    parseImageAspectRatio
} from "@/lib/image-aspect-ratios"
import { getReferenceImageSources } from "@/lib/generated-image-urls"
import { getRequiredPlanToPickModel } from "@/lib/models-providers-shared"
import { useSharedModels } from "@/lib/shared-models"
import { cn } from "@/lib/utils"
import { useAction, useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { ArrowLeft, ChevronRight, ImagePlus, Loader2, Minus, Plus, Sparkles, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useGenerationStore } from "./generation-store"
import {
    type LibraryReference,
    areReferencesStale,
    useLibraryReferencesStore
} from "./reference-store"

const DEFAULT_VARIANTS_PER_MODEL = 1
const MAX_TOTAL_GENERATIONS_PER_RUN = 10
const MIN_POST_SUBMISSION_HOLD_MS = 1_000
const MAX_POST_SUBMISSION_HOLD_MS = 4_000
const LEGACY_IMAGE_MODEL_MIGRATION_KEY_PREFIX = "legacy-image-model-migrated"
const MIN_PROMPT_HEIGHT = 112
const MAX_PROMPT_VIEWPORT_RATIO = 0.4
const IMAGE_RESOLUTIONS = ["1K", "2K", "4K"] as const
const BACKGROUND_OPTIONS = ["opaque", "transparent"] as const
// Same label as the thread list's group labels, which this panel replaces.
const SECTION_LABEL_CLASS = "font-medium text-sidebar-foreground/70 text-xs"
// The stock segmented track and thumb take their colors from --background and
// --input, so here their contrast would depend on how far a theme puts those from
// --sidebar, and several themes put them almost on top of it. Each layer tints
// the one under it with black or white instead, so the step from sidebar to track
// to thumb is the same in every theme.
const SIDEBAR_TRACK_CLASS = "bg-black/8 dark:bg-white/7"
// Tabs draws its thumb itself, so the list restyles it from outside.
const SIDEBAR_TABS_CLASS = cn(
    SIDEBAR_TRACK_CLASS,
    "**:data-[slot=tabs-selection-indicator]:bg-white/90 dark:**:data-[slot=tabs-selection-indicator]:border-white/4 dark:**:data-[slot=tabs-selection-indicator]:bg-white/6"
)
// Same motion as the sidebar swapping between threads and the library.
const PAGE_TRANSITION_CLASS =
    "transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
const STEPPER_BUTTON_CLASS =
    "flex h-full w-8 items-center justify-center rounded-[var(--radius-sm)] transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/6"

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

// Keeps each lab's models together, labs in the order their first model appears.
// Image models all run through fal, so the lab is the registry's icon field.
const orderModelsByLab = (models: readonly SharedModel[]) => {
    const byLab = new Map<string, SharedModel[]>()
    for (const model of models) {
        const lab = model.customIcon ?? "other"
        byLab.set(lab, [...(byLab.get(lab) ?? []), model])
    }
    return [...byLab.values()].flat()
}

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

type PendingReference = {
    // Re-adding an image mid-upload reuses its hash, so each attempt gets its own id.
    uploadId: string
    sourceHash: string
    progress: number
    status: "uploading" | "success" | "ready"
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const NO_REFERENCES: LibraryReference[] = []
const REFERENCE_INPUT_LIMIT_LABEL = formatFileSizeLimit(DEFAULT_UPLOAD_POLICY.maxFileSize)

const getFileSha256 = async (file: File) => {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
    return Array.from(new Uint8Array(hashBuffer))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
}

export function ImageGenerationSidebar({ disabled = false }: { disabled?: boolean }) {
    const { token } = useToken()
    const creditPlan = useCreditAccess((state) => state.plan)
    const isStaff = useCreditAccess((state) => state.isStaff)
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
        setResolution,
        transparentBackgroundModelIds,
        setModelTransparentBackground
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
    const imageQualityOverrides = useDevOverridesStore((state) => state.imageQualityOverrides)
    const setImageQualityOverride = useDevOverridesStore((state) => state.setImageQualityOverride)
    const getImageQualityOverride = (
        model: SharedModel | undefined
    ): Exclude<ImageQuality, "auto"> | undefined => {
        if (!model?.supportedImageQualities?.length) return undefined
        const quality = imageQualityOverrides[model.id] ?? model.defaultImageQuality
        return quality && quality !== "auto" && model.supportedImageQualities.includes(quality)
            ? quality
            : undefined
    }
    const imageReasoningEffortOverrides = useDevOverridesStore(
        (state) => state.imageReasoningEffortOverrides
    )
    const setImageReasoningEffortOverride = useDevOverridesStore(
        (state) => state.setImageReasoningEffortOverride
    )
    const getImageReasoningEffortOverride = (
        model: SharedModel | undefined
    ): ImageReasoningEffort | undefined => {
        if (!model?.supportedImageReasoningEfforts?.length) return undefined
        const effort = imageReasoningEffortOverrides[model.id] ?? model.defaultImageReasoningEffort
        return effort && model.supportedImageReasoningEfforts.includes(effort) ? effort : undefined
    }
    const setImageVariantMax = useDevOverridesStore((state) => state.setImageVariantMax)
    const setImageReferenceMax = useDevOverridesStore((state) => state.setImageReferenceMax)
    const setImageRunTotalMax = useDevOverridesStore((state) => state.setImageRunTotalMax)
    const setAspectRatioOverride = useDevOverridesStore((state) => state.setAspectRatioOverride)
    const setDisableImageCompression = useDevOverridesStore(
        (state) => state.setDisableImageCompression
    )
    const resetImageQualityOverrides = useDevOverridesStore(
        (state) => state.resetImageQualityOverrides
    )

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
    const isAspectRatioOverrideInvalid =
        Boolean(aspectRatioOverride) && !parseImageAspectRatio(aspectRatioOverride ?? undefined)

    const { data: session } = useSession()
    const userId = session?.user?.id
    const referencesOwnerId = useLibraryReferencesStore((state) => state.ownerId)
    const storedReferences = useLibraryReferencesStore((state) => state.references)
    const references = userId && referencesOwnerId === userId ? storedReferences : NO_REFERENCES
    // References still being optimized and uploaded; these never persist.
    const [pendingReferences, setPendingReferencesState] = useState<PendingReference[]>([])
    const pendingReferencesRef = useRef(pendingReferences)
    // Local previews for references added in this tab, so tiles don't refetch once uploaded.
    const [referencePreviews, setReferencePreviews] = useState<Record<string, string>>({})
    const referenceCount = references.length + pendingReferences.length
    const [staleReferencesRun, setStaleReferencesRun] = useState<(() => Promise<void>) | null>(null)
    const [fakeResponseTimeSeconds, setFakeResponseTimeSeconds] = useState(15)
    const canSelectImageQuality = isDevMode || isStaff
    // Null while the legacy accordion is closed. Open, it holds the legacy models that
    // were already listed above it, which stay there until it closes.
    const [legacyAccordionSnapshot, setLegacyAccordionSnapshot] =
        useState<ReadonlySet<string> | null>(null)
    const expandedLegacyModels = legacyAccordionSnapshot !== null
    const [promptHeight, setPromptHeight] = useState<number | null>(null)
    const [isResizingPrompt, setIsResizingPrompt] = useState(false)
    // The model whose settings page covers the list, if any.
    const [detailModelId, setDetailModelId] = useState<string | null>(null)
    const previousDetailModelIdRef = useRef<string | null>(null)
    const modelListRef = useRef<HTMLDivElement>(null)
    const detailBackButtonRef = useRef<HTMLButtonElement>(null)

    // A model that leaves the selection by any route closes its page.
    useEffect(() => {
        if (detailModelId && !selectedModelIds.includes(detailModelId)) {
            setDetailModelId(null)
        }
    }, [detailModelId, selectedModelIds])

    // The page swap hides whatever had focus, so hand focus to the page's Back
    // button, and back to the model's row on return.
    useEffect(() => {
        const previousDetailModelId = previousDetailModelIdRef.current
        previousDetailModelIdRef.current = detailModelId
        if (detailModelId) {
            detailBackButtonRef.current?.focus({ preventScroll: true })
        } else if (previousDetailModelId) {
            modelListRef.current
                ?.querySelector<HTMLElement>(
                    `[data-model-row="${CSS.escape(previousDetailModelId)}"]`
                )
                ?.focus({ preventScroll: true })
        }
    }, [detailModelId])
    const [sessionRevealedLegacyModelIds, setSessionRevealedLegacyModelIds] = useState<Set<string>>(
        () => new Set()
    )
    const promptTextareaRef = useRef<HTMLTextAreaElement>(null)
    const promptResizeRef = useRef<{
        pointerId: number
        startY: number
        startHeight: number
        maxHeight: number
    } | null>(null)
    const seenLegacyMigrationKeysRef = useRef<Set<string>>(new Set())
    const sessionRevealedLegacyModelIdsRef = useRef<Set<string>>(new Set())

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

    // Saved references belong to one account; another sign-in on this browser drops them.
    useEffect(() => {
        if (userId) useLibraryReferencesStore.getState().claimReferences(userId)
    }, [userId])

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

    const generateImage = useAction(api.images_node.generateStandaloneImage)
    const generateFakeImage = useAction(api.images_node.generateFakeStandaloneImage)
    const releaseReferenceUpload = useMutation(api.reference_uploads.releaseReferenceUpload)
    // The server only deletes references no generation has used yet.
    const releaseReferenceUploads = (keys: string[]) => {
        for (const key of keys) {
            releaseReferenceUpload({ key }).catch((error) =>
                console.error("Failed to release reference upload:", error)
            )
        }
    }
    const [generationMode, setGenerationMode] = useState<"real" | "fake" | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const isGenerating = generationMode !== null

    const referencePreviewsRef = useRef(referencePreviews)
    useEffect(() => {
        referencePreviewsRef.current = referencePreviews
    }, [referencePreviews])

    useEffect(() => {
        return () => {
            for (const preview of Object.values(referencePreviewsRef.current)) {
                URL.revokeObjectURL(preview)
            }
        }
    }, [])

    const setPendingReferences = (update: (pending: PendingReference[]) => PendingReference[]) => {
        pendingReferencesRef.current = update(pendingReferencesRef.current)
        setPendingReferencesState(pendingReferencesRef.current)
    }
    const dropPendingReference = (sourceHash: string) =>
        setPendingReferences((pending) =>
            pending.filter((reference) => reference.sourceHash !== sourceHash)
        )

    const dropReferencePreview = (sourceHash: string) =>
        setReferencePreviews((previews) => {
            if (!previews[sourceHash]) return previews
            URL.revokeObjectURL(previews[sourceHash])
            const { [sourceHash]: _dropped, ...rest } = previews
            return rest
        })

    // Optimize and upload as soon as a reference is added, so Generate only sends keys.
    const uploadReference = async (file: File, sourceHash: string, uploadId: string) => {
        const startedAt = Date.now()
        const updatePendingReference = (patch: Partial<PendingReference>) =>
            setPendingReferences((pending) =>
                pending.map((reference) =>
                    reference.uploadId === uploadId ? { ...reference, ...patch } : reference
                )
            )
        const dropOwnPendingReference = () =>
            setPendingReferences((pending) =>
                pending.filter((reference) => reference.uploadId !== uploadId)
            )
        try {
            const preparedFile = await prepareChatAttachmentForUpload(file, undefined, {
                skipImageCompression: overridesActive && disableImageCompression
            })
            const jwt = await resolveJwtToken(token)
            if (!jwt) {
                throw new Error("Authentication token unavailable")
            }
            const uploaded = await uploadFileDirect({
                file: preparedFile,
                jwt,
                uploadBaseUrl: `${browserEnv("VITE_CONVEX_API_URL")}/upload`,
                purpose: "reference",
                onProgress: (progress) => updatePendingReference({ progress })
            })
            // Same tick-then-fade as composer uploads before the tile settles.
            updatePendingReference({ progress: 100, status: "success" })
            await delay(Math.max(0, 500 - (Date.now() - startedAt)) + 500)
            updatePendingReference({ status: "ready" })
            await delay(200)
            // Skip references the user removed while they were uploading. Leave pending
            // before landing in the store so the tile never renders twice.
            const stillWanted = pendingReferencesRef.current.some(
                (reference) => reference.uploadId === uploadId
            )
            dropOwnPendingReference()
            if (stillWanted) {
                useLibraryReferencesStore
                    .getState()
                    .addReference({ sourceHash, storageKey: uploaded.key })
            } else {
                releaseReferenceUploads([uploaded.key])
            }
        } catch (error) {
            console.error("Failed to upload reference image:", error)
            toast.error(error instanceof Error ? error.message : "Reference could not be uploaded")
            dropOwnPendingReference()
            if (
                !pendingReferencesRef.current.some(
                    (reference) => reference.sourceHash === sourceHash
                )
            ) {
                dropReferencePreview(sourceHash)
            }
        }
    }

    const addReferenceFiles = async (files: File[]) => {
        if (generationPanelDisabled || selectedRequiresPlanUpgrade || files.length === 0) return
        if (!supportsReferenceImagesForSelection) {
            toast.error("Reference images are not supported for the selected model set")
            return
        }

        const acceptedFiles = files.filter((file) => file.size <= DEFAULT_UPLOAD_POLICY.maxFileSize)
        if (acceptedFiles.length < files.length) {
            toast.error(`Reference images must be smaller than ${REFERENCE_INPUT_LIMIT_LABEL}.`)
        }

        const knownHashes = new Set([
            ...useLibraryReferencesStore.getState().references.map((ref) => ref.sourceHash),
            ...pendingReferencesRef.current.map((reference) => reference.sourceHash)
        ])
        for (const file of acceptedFiles) {
            // Hash the original: re-encoding one source can produce different bytes each time.
            const sourceHash = await getFileSha256(file)
            if (knownHashes.has(sourceHash)) continue
            if (
                typeof selectedReferenceLimit === "number" &&
                knownHashes.size >= selectedReferenceLimit
            ) {
                toast.error(
                    `The selected model set supports up to ${selectedReferenceLimit} reference images. Deselect limited models to add more.`
                )
                return
            }

            knownHashes.add(sourceHash)
            setReferencePreviews((previews) => ({
                ...previews,
                [sourceHash]: URL.createObjectURL(file)
            }))
            const uploadId = crypto.randomUUID()
            setPendingReferences((pending) => [
                ...pending,
                { uploadId, sourceHash, progress: 0, status: "uploading" }
            ])
            void uploadReference(file, sourceHash, uploadId)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        void addReferenceFiles(Array.from(e.target.files || []))
        e.target.value = ""
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        if (generationPanelDisabled || selectedRequiresPlanUpgrade) {
            e.preventDefault()
            return
        }

        const files = Array.from(e.clipboardData.items)
            .filter((item) => item.type.startsWith("image/"))
            .map((item) => item.getAsFile())
            .filter((file): file is File => file !== null)
        if (files.length === 0) return

        e.preventDefault()
        void addReferenceFiles(files)
    }

    const getReferencePreviewSrc = (reference: { sourceHash: string; storageKey?: string }) =>
        referencePreviews[reference.sourceHash] ??
        (reference.storageKey ? getReferenceImageSources(reference.storageKey).src : undefined)

    const removeReference = (sourceHash: string) => {
        dropPendingReference(sourceHash)
        const store = useLibraryReferencesStore.getState()
        releaseReferenceUploads(
            store.references
                .filter((reference) => reference.sourceHash === sourceHash)
                .map((reference) => reference.storageKey)
        )
        store.removeReference(sourceHash)
        dropReferencePreview(sourceHash)
    }

    // Returns whether the selection changed.
    const toggleModel = (modelId: string) => {
        if (lockedModelIds.has(modelId)) {
            return false
        }

        const isSelected = selectedModelIds.includes(modelId)
        const selectedModelReferenceLimit = resolveModelReferenceLimit(
            imageModels.find((model) => model.id === modelId)
        )
        if (
            !isSelected &&
            typeof selectedModelReferenceLimit === "number" &&
            referenceCount > selectedModelReferenceLimit
        ) {
            toast.error(
                `This model supports up to ${selectedModelReferenceLimit} reference images. Remove references to select it.`
            )
            return false
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
            return false
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
        return true
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
    // Legacy models listed with the current ones: those in the run or picked this
    // session. The set is frozen while the accordion is open, so neither opening it nor
    // picking a model inside it moves a row.
    const listedLegacyModelIds = legacyAccordionSnapshot ?? collapsedVisibleLegacyModelIds
    const { listedModels, accordionLegacyModels } = useMemo(() => {
        // Free plans see their pickable models first so the list doesn't open on locked rows.
        const byPlanLock = (left: SharedModel, right: SharedModel) =>
            Number(lockedModelIds.has(left.id)) - Number(lockedModelIds.has(right.id))
        const currentModels = imageModels
            .filter((model) => !isLegacyImageModel(model))
            .sort(byPlanLock)
        const legacyModels = imageModels.filter(isLegacyImageModel).sort(byPlanLock)

        return {
            listedModels: orderModelsByLab([
                ...currentModels,
                ...legacyModels.filter((model) => listedLegacyModelIds.has(model.id))
            ]),
            accordionLegacyModels: orderModelsByLab(
                legacyModels.filter((model) => !listedLegacyModelIds.has(model.id))
            )
        }
    }, [imageModels, listedLegacyModelIds, lockedModelIds])

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
        () => referenceCount === 1 && selectedModels.some((model) => model.customIcon === "xai"),
        [referenceCount, selectedModels]
    )

    const canGenerateBase =
        selectedModelIds.length > 0 && !isGenerating && commonImageSizes.length > 0
    const normalizedPrompt = prompt.trim()
    const canSubmitGeneration =
        canGenerateBase &&
        Boolean(normalizedPrompt) &&
        !generationPanelDisabled &&
        !selectedRequiresPlanUpgrade &&
        pendingReferences.length === 0 &&
        !(overridesActive && isAspectRatioOverrideInvalid)

    // Reads the store directly: the stale-reference dialog may have just cleared it.
    const getSubmittableReferenceKeys = () => {
        const keys = useLibraryReferencesStore
            .getState()
            .references.map((reference) => reference.storageKey)
        if (keys.length > 0 && !supportsReferenceImagesForSelection) {
            toast.error("Reference images are not supported for the selected model set")
            return null
        }
        if (typeof selectedReferenceLimit === "number" && keys.length > selectedReferenceLimit) {
            toast.error(
                `The selected model set supports up to ${selectedReferenceLimit} reference images. Remove references to generate.`
            )
            return null
        }
        return keys
    }

    // A reference set nobody has touched for a day is likely a leftover; confirm before
    // spending credits on it.
    const confirmReferencesThenRun = (run: () => Promise<void>) => {
        const { references: currentReferences, touchedAt } = useLibraryReferencesStore.getState()
        if (currentReferences.length > 0 && areReferencesStale(touchedAt)) {
            setStaleReferencesRun(() => run)
            return
        }
        void run()
    }

    const handleGenerate = async () => {
        if (generationPanelDisabled || selectedRequiresPlanUpgrade) return
        if (!normalizedPrompt || selectedModelIds.length === 0) return
        const referenceImageIds = getSubmittableReferenceKeys()
        if (!referenceImageIds) return

        setGenerationMode("real")
        try {
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
                                referenceImageIds,
                                ...(canSelectImageQuality && model?.supportedImageQualities?.length
                                    ? { quality: getImageQualityOverride(model) }
                                    : {}),
                                ...(canSelectImageQuality &&
                                model?.supportedImageReasoningEfforts?.length
                                    ? { reasoningEffort: getImageReasoningEffortOverride(model) }
                                    : {}),
                                ...(model?.supportsTransparentBackground &&
                                transparentBackgroundModelIds.includes(modelId)
                                    ? { transparentBackground: true }
                                    : {}),
                                ...(supportsResolution ? { resolution } : {})
                            })
                        })
                    })
                    .map((runGeneration) => runGeneration())
            )
            if (referenceImageIds.length > 0) {
                useLibraryReferencesStore.getState().touchReferences()
            }

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
            toast.error(getGenerationErrorMessage(error, "Failed to generate image"))
        } finally {
            setGenerationMode(null)
        }
    }

    const handleFakeGenerate = async () => {
        if (generationPanelDisabled || selectedRequiresPlanUpgrade) return
        if (!isDevMode || !normalizedPrompt || selectedModelIds.length === 0) return
        const referenceImageIds = getSubmittableReferenceKeys()
        if (!referenceImageIds) return

        setGenerationMode("fake")
        try {
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
                                    referenceImageIds,
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
            if (referenceImageIds.length > 0) {
                useLibraryReferencesStore.getState().touchReferences()
            }

            const failedResult = results.find(
                (result): result is PromiseRejectedResult => result.status === "rejected"
            )
            if (failedResult) {
                throw failedResult.reason
            }
        } catch (error) {
            console.error("Failed to run fake image generation:", error)
            toast.error(getGenerationErrorMessage(error, "Failed to run fake image generation"))
        } finally {
            setGenerationMode(null)
        }
    }

    // One model's row. Inside the legacy accordion the rows skip their "Legacy"
    // line, since the accordion already says so.
    const renderModelRow = (model: SharedModel, notesLegacy: boolean) => {
        const isSelected = selectedModelIds.includes(model.id)
        const modelPlanLocked = lockedModelIds.has(model.id)
        const modelReferenceLimit = resolveModelReferenceLimit(model)
        const modelReferenceLocked =
            !isSelected &&
            typeof modelReferenceLimit === "number" &&
            referenceCount > modelReferenceLimit
        const modelDisabled = modelPlanLocked || modelReferenceLocked
        const isLegacyModel = isLegacyImageModel(model)
        const modelCount = selectedModelCounts[model.id] ?? DEFAULT_VARIANTS_PER_MODEL
        // A row only carries a second line when something is off.
        const modelNote = modelPlanLocked
            ? "Pro plan required"
            : modelReferenceLocked
              ? `Max ${modelReferenceLimit} references`
              : isLegacyModel && notesLegacy
                ? "Legacy"
                : null
        const showsQuality = canSelectImageQuality && Boolean(model.supportedImageQualities?.length)

        const showsReasoning =
            canSelectImageQuality && Boolean(model.supportedImageReasoningEfforts?.length)
        // Staff-only settings live on the model's page, so only a model
        // that has some gets a way in.
        const hasModelPage = showsQuality || showsReasoning
        const canIncrement =
            modelCount < resolveVariantMax(model) &&
            totalRequestedGenerations < effectiveRunTotalMax
        const isTransparent = transparentBackgroundModelIds.includes(model.id)

        // A click adds or removes the model. In the run, the row fills and
        // gains one line holding the settings every user has.
        return (
            <div
                key={model.id}
                className={cn(
                    // A model in the run is a Spotlight card, the one accented
                    // surface in a sidebar of plain text. Every row keeps a
                    // border so picking one does not shift its neighbors.
                    "rounded-[var(--radius-lg)] border transition-colors",
                    isSelected ? SPOTLIGHT_CARD_CLASS : "border-transparent text-muted-foreground",
                    !isSelected &&
                        !modelDisabled &&
                        "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    modelDisabled && "cursor-not-allowed opacity-50"
                )}
            >
                <div className="flex items-center">
                    <button
                        type="button"
                        aria-pressed={isSelected}
                        data-model-row={model.id}
                        onClick={() => {
                            toggleModel(model.id)
                        }}
                        disabled={modelDisabled}
                        className={cn(
                            "flex min-w-0 flex-1 items-center gap-2 rounded-[inherit] p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:cursor-not-allowed",
                            isSelected && hasModelPage && "pr-1"
                        )}
                    >
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium">{model.name}</span>
                            {modelNote && <span className="text-xs opacity-70">{modelNote}</span>}
                        </span>
                        <ImageCostIndicator
                            model={model}
                            aspectRatio={effectiveAspectRatio}
                            resolution={resolution}
                            quality={showsQuality ? getImageQualityOverride(model) : undefined}
                            variants={modelCount}
                            referenceCount={referenceCount}
                        />
                    </button>
                    {isSelected && hasModelPage && (
                        <button
                            type="button"
                            aria-label={`More ${model.name} settings`}
                            onClick={() => setDetailModelId(model.id)}
                            // The chevron's stroke ends 8px from the row's edge,
                            // in line with the switch below it.
                            className="flex h-9 w-6 shrink-0 items-center justify-end rounded-[var(--radius-md)] pr-0.5 opacity-60 outline-none transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                        >
                            <ChevronRight className="size-4" />
                        </button>
                    )}
                </div>
                {isSelected && (
                    // One setting per line, label left and control right, so
                    // the controls share the cost glyph's edge instead of
                    // crowding one line.
                    <div className="flex flex-col gap-2 px-2 pt-1 pb-3">
                        <div className="flex min-h-7 items-center justify-between gap-3">
                            <span className="text-xs opacity-70">Variants</span>
                            <div
                                className={cn(
                                    "inline-flex h-7 items-center rounded-[var(--radius-md)] p-[3px]",
                                    SIDEBAR_TRACK_CLASS
                                )}
                            >
                                <button
                                    type="button"
                                    aria-label={`Fewer ${model.name} variants`}
                                    onClick={() => updateModelCount(model.id, modelCount - 1)}
                                    disabled={modelPlanLocked || modelCount <= 1}
                                    className={cn(STEPPER_BUTTON_CLASS, "w-6")}
                                >
                                    <Minus className="size-3" />
                                </button>
                                <span className="min-w-6 text-center font-medium text-xs tabular-nums">
                                    {modelCount}
                                </span>
                                <button
                                    type="button"
                                    aria-label={`More ${model.name} variants`}
                                    onClick={() => updateModelCount(model.id, modelCount + 1)}
                                    disabled={modelPlanLocked || !canIncrement}
                                    className={cn(STEPPER_BUTTON_CLASS, "w-6")}
                                >
                                    <Plus className="size-3" />
                                </button>
                            </div>
                        </div>
                        {model.supportsTransparentBackground && (
                            <label
                                htmlFor={`transparent-background-${model.id}`}
                                className="flex min-h-7 items-center justify-between gap-3 text-xs"
                            >
                                <span className="opacity-70">Transparent background</span>
                                <Switch
                                    id={`transparent-background-${model.id}`}
                                    checked={isTransparent}
                                    onCheckedChange={(checked) =>
                                        setModelTransparentBackground(model.id, checked)
                                    }
                                />
                            </label>
                        )}
                    </div>
                )}
            </div>
        )
    }

    const legacyToggle = (
        <button
            type="button"
            aria-expanded={expandedLegacyModels}
            onClick={() =>
                setLegacyAccordionSnapshot((snapshot) =>
                    snapshot === null ? collapsedVisibleLegacyModelIds : null
                )
            }
            className="flex h-8 w-full items-center gap-1 rounded-[var(--radius-md)] px-2 font-medium text-sidebar-foreground/70 text-xs outline-none transition-colors hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
            <ChevronRight
                className={cn("size-4 transition-transform", expandedLegacyModels && "rotate-90")}
            />
            {listedLegacyModelIds.size > 0 ? "More legacy models" : "Legacy models"}
        </button>
    )

    const detailModel = detailModelId
        ? selectedModels.find((model) => model.id === detailModelId)
        : undefined
    const isDetailOpen = detailModel !== undefined
    const detailModelCount = detailModel
        ? (selectedModelCounts[detailModel.id] ?? DEFAULT_VARIANTS_PER_MODEL)
        : DEFAULT_VARIANTS_PER_MODEL

    return (
        <div className="relative h-full w-full text-sidebar-foreground text-sm">
            <fieldset
                disabled={generationPanelDisabled}
                className={cn(
                    "absolute inset-0 min-w-0",
                    generationPanelDisabled && "opacity-50 blur-sm"
                )}
            >
                {/* Two pages share the panel: the run's settings, and one model's
                    settings. Each scrolls under the Generate bar, so its last section
                    clears the bar with bottom padding. */}
                <div
                    className={cn(
                        "absolute inset-0",
                        isDetailOpen && "pointer-events-none invisible"
                    )}
                >
                    <div
                        ref={modelListRef}
                        className={cn(
                            "scrollbar-hide h-full overflow-y-auto",
                            PAGE_TRANSITION_CLASS,
                            isDetailOpen ? "-translate-x-4 opacity-0" : "translate-x-0 opacity-100"
                        )}
                    >
                        <div className="flex flex-col gap-6 px-4 pt-2 pb-24">
                            {/* Prompt, with its references inside the field like composer attachments. */}
                            <div className="flex flex-col gap-2">
                                <div className="overflow-hidden rounded-[var(--radius-lg)] border border-input shadow-xs dark:bg-input/30">
                                    <Textarea
                                        ref={promptTextareaRef}
                                        aria-label="Prompt"
                                        placeholder="Describe your image..."
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        onPaste={handlePaste}
                                        style={
                                            promptHeight === null
                                                ? undefined
                                                : { height: promptHeight }
                                        }
                                        className="field-sizing-fixed max-h-[40dvh] min-h-[7rem] resize-none overflow-y-auto rounded-none border-0 bg-transparent px-3 py-3 text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
                                    />

                                    {referenceCount > 0 && (
                                        <div className="flex flex-wrap gap-2 px-3 pt-2 pb-1">
                                            {references.map((reference) => (
                                                <div
                                                    key={reference.sourceHash}
                                                    className="group relative shrink-0"
                                                >
                                                    <AttachmentTile
                                                        fileName="Reference image"
                                                        nativeTitle={false}
                                                        previewUrl={getReferencePreviewSrc(
                                                            reference
                                                        )}
                                                    />
                                                    {/* An in-flight generation still reads this reference. */}
                                                    {!isGenerating && (
                                                        <AttachmentAction
                                                            label="Remove reference"
                                                            onClick={() =>
                                                                removeReference(
                                                                    reference.sourceHash
                                                                )
                                                            }
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                            {pendingReferences.map((reference) => (
                                                <div
                                                    key={reference.sourceHash}
                                                    className="group relative shrink-0"
                                                >
                                                    <AttachmentTile
                                                        fileName="Reference image"
                                                        nativeTitle={false}
                                                        status={reference.status}
                                                        progress={reference.progress}
                                                        previewUrl={getReferencePreviewSrc(
                                                            reference
                                                        )}
                                                    />
                                                    <AttachmentAction
                                                        label="Cancel upload"
                                                        onClick={() =>
                                                            removeReference(reference.sourceHash)
                                                        }
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center p-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Add reference images"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={
                                                !supportsReferenceImagesForSelection ||
                                                selectedRequiresPlanUpgrade
                                            }
                                            className="size-8 text-muted-foreground hover:text-foreground"
                                        >
                                            <ImagePlus />
                                        </Button>
                                        {!isTouchDevice ? (
                                            <>
                                                <button
                                                    type="button"
                                                    aria-label="Resize prompt vertically"
                                                    onPointerDown={handlePromptResizeStart}
                                                    onPointerMove={handlePromptResizeMove}
                                                    onPointerUp={handlePromptResizeEnd}
                                                    onPointerCancel={handlePromptResizeEnd}
                                                    className="group flex h-8 flex-1 cursor-ns-resize touch-none items-center justify-center outline-none"
                                                >
                                                    <span
                                                        className={cn(
                                                            "h-0.5 w-8 rounded-[var(--radius-sm)] bg-muted-foreground/25 transition-colors group-hover:bg-muted-foreground/60 group-focus-visible:bg-muted-foreground/60",
                                                            isResizingPrompt &&
                                                                "bg-muted-foreground/60"
                                                        )}
                                                    />
                                                </button>
                                                {/* Balances the add button so the grip stays centered. */}
                                                <div
                                                    aria-hidden="true"
                                                    className="size-8 shrink-0"
                                                />
                                            </>
                                        ) : null}
                                    </div>
                                </div>

                                {!supportsReferenceImagesForSelection && (
                                    <p className="text-muted-foreground text-xs">
                                        Reference images are unavailable for the current model
                                        selection.
                                    </p>
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

                            <section className="flex flex-col gap-2">
                                <h3 className={SECTION_LABEL_CLASS}>Aspect ratio</h3>
                                <Tabs value={aspectRatio} onValueChange={setAspectRatio}>
                                    <TabsList
                                        className={cn("h-auto w-full", SIDEBAR_TABS_CLASS)}
                                        aria-label="Aspect ratio"
                                    >
                                        {SELECTABLE_IMAGE_ASPECT_RATIOS.map((size) => {
                                            const [wStr, hStr] = size.split(":")
                                            const w = Number.parseInt(wStr, 10) || 1
                                            const h = Number.parseInt(hStr, 10) || 1

                                            return (
                                                <TabsTrigger
                                                    key={size}
                                                    value={size}
                                                    disabled={!commonImageSizes.includes(size)}
                                                    className="h-auto flex-col gap-1 px-0 py-1.5 text-[0.6875rem] tabular-nums disabled:opacity-30"
                                                >
                                                    <span className="flex h-[1.125rem] items-center justify-center">
                                                        <span
                                                            className="rounded-[calc(var(--radius-sm)/2)] border-2 border-current"
                                                            style={{
                                                                width:
                                                                    w >= h
                                                                        ? "1.125rem"
                                                                        : `${Math.max(0.625, 1.125 * (w / h))}rem`,
                                                                height:
                                                                    h >= w
                                                                        ? "1.125rem"
                                                                        : `${Math.max(0.625, 1.125 * (h / w))}rem`
                                                            }}
                                                        />
                                                    </span>
                                                    {size}
                                                </TabsTrigger>
                                            )
                                        })}
                                    </TabsList>
                                </Tabs>
                                {hasSingleReferenceXaiEdit && (
                                    <p className="text-muted-foreground text-xs leading-relaxed">
                                        xAI single-image edits keep the input image's aspect ratio.
                                        The aspect ratio picker only reliably applies to
                                        text-to-image and multi-image edits.
                                    </p>
                                )}
                            </section>

                            <section className="flex flex-col gap-2">
                                <h3 className={SECTION_LABEL_CLASS}>Resolution</h3>
                                <Tabs value={resolution} onValueChange={setResolution}>
                                    <TabsList
                                        className={cn("h-8 w-full", SIDEBAR_TABS_CLASS)}
                                        aria-label="Resolution"
                                    >
                                        {IMAGE_RESOLUTIONS.map((res) => (
                                            <TabsTrigger
                                                key={res}
                                                value={res}
                                                disabled={!commonImageResolutions.includes(res)}
                                                className="px-2 text-xs disabled:opacity-30"
                                            >
                                                {res}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                </Tabs>
                            </section>

                            <section className="flex flex-col gap-2">
                                <h3 className={SECTION_LABEL_CLASS}>Models</h3>
                                {/* Rows bleed into the gutter like thread rows, so names line up
                                    with the section labels. */}
                                <div className="-mx-2 flex flex-col gap-1.5">
                                    {listedModels.map((model) => renderModelRow(model, true))}
                                </div>
                                {accordionLegacyModels.length > 0 && (
                                    <div>
                                        <div className="-mx-2">{legacyToggle}</div>
                                        {/* The clip box is widened to the gutter so the rows'
                                            bleed is not cut off. */}
                                        <AnimatedCollapsible
                                            open={expandedLegacyModels}
                                            className="-mx-2"
                                            contentClassName="px-2"
                                        >
                                            <div
                                                inert={!expandedLegacyModels}
                                                className="-mx-2 flex flex-col gap-1.5 pt-1"
                                            >
                                                {accordionLegacyModels.map((model) =>
                                                    renderModelRow(model, false)
                                                )}
                                            </div>
                                        </AnimatedCollapsible>
                                    </div>
                                )}
                            </section>

                            {isDevMode && (
                                <section className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className={SECTION_LABEL_CLASS}>Image lab overrides</h3>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="-my-1 h-6 rounded-[var(--radius-sm)] px-2 text-xs"
                                            onClick={() => {
                                                setImageVariantMax(null)
                                                setImageRunTotalMax(null)
                                                setImageReferenceMax(null)
                                                setAspectRatioOverride(null)
                                                setDisableImageCompression(false)
                                                resetImageQualityOverrides()
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
                                        <span className="text-muted-foreground text-xs">
                                            Aspect ratio (blank = auto)
                                        </span>
                                        <Input
                                            value={aspectRatioOverride ?? ""}
                                            placeholder="e.g. 21:9"
                                            aria-invalid={isAspectRatioOverrideInvalid}
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
                                </section>
                            )}

                            {isDevMode && (
                                <section className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className={SECTION_LABEL_CLASS}>Fake response time</h3>
                                        <span className="font-medium text-xs tabular-nums">
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
                                </section>
                            )}
                        </div>
                    </div>
                </div>

                <div
                    className={cn(
                        "absolute inset-0",
                        !isDetailOpen && "pointer-events-none invisible"
                    )}
                >
                    <div
                        className={cn(
                            "scrollbar-hide h-full overflow-y-auto",
                            PAGE_TRANSITION_CLASS,
                            isDetailOpen ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
                        )}
                    >
                        {detailModel && (
                            <div className="flex flex-col gap-6 pt-1 pb-24">
                                <div className="flex items-center gap-1 px-2">
                                    <Button
                                        ref={detailBackButtonRef}
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Back to models"
                                        onClick={() => setDetailModelId(null)}
                                        className="size-8 text-muted-foreground hover:text-foreground"
                                    >
                                        <ArrowLeft />
                                    </Button>
                                    <h2 className="min-w-0 flex-1 truncate font-medium">
                                        {detailModel.name}
                                    </h2>
                                    {/* The run needs a model, so the last one cannot be removed. */}
                                    {selectedModelIds.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Remove ${detailModel.name} from the selection`}
                                            onClick={() => {
                                                toggleModel(detailModel.id)
                                                setDetailModelId(null)
                                            }}
                                            className="size-8 text-muted-foreground hover:text-foreground"
                                        >
                                            <X />
                                        </Button>
                                    )}
                                </div>

                                <div className="flex flex-col gap-6 px-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className={SECTION_LABEL_CLASS}>Variants</span>
                                        <div
                                            className={cn(
                                                "inline-flex h-8 items-center rounded-[var(--radius-md)] p-[3px]",
                                                SIDEBAR_TRACK_CLASS
                                            )}
                                        >
                                            <button
                                                type="button"
                                                aria-label="Fewer variants"
                                                onClick={() =>
                                                    updateModelCount(
                                                        detailModel.id,
                                                        detailModelCount - 1
                                                    )
                                                }
                                                disabled={
                                                    lockedModelIds.has(detailModel.id) ||
                                                    detailModelCount <= 1
                                                }
                                                className={STEPPER_BUTTON_CLASS}
                                            >
                                                <Minus className="size-3.5" />
                                            </button>
                                            <span className="min-w-8 text-center font-medium tabular-nums">
                                                {detailModelCount}
                                            </span>
                                            <button
                                                type="button"
                                                aria-label="More variants"
                                                onClick={() =>
                                                    updateModelCount(
                                                        detailModel.id,
                                                        detailModelCount + 1
                                                    )
                                                }
                                                disabled={
                                                    lockedModelIds.has(detailModel.id) ||
                                                    detailModelCount >=
                                                        resolveVariantMax(detailModel) ||
                                                    totalRequestedGenerations >=
                                                        effectiveRunTotalMax
                                                }
                                                className={STEPPER_BUTTON_CLASS}
                                            >
                                                <Plus className="size-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    {canSelectImageQuality &&
                                        Boolean(detailModel.supportedImageQualities?.length) && (
                                            <ModelSettingTabs
                                                label="Quality"
                                                value={getImageQualityOverride(detailModel)}
                                                options={detailModel.supportedImageQualities ?? []}
                                                onChange={(quality) =>
                                                    setImageQualityOverride(detailModel.id, quality)
                                                }
                                            />
                                        )}
                                    {canSelectImageQuality &&
                                        Boolean(
                                            detailModel.supportedImageReasoningEfforts?.length
                                        ) && (
                                            <ModelSettingTabs
                                                label="Reasoning"
                                                value={getImageReasoningEffortOverride(detailModel)}
                                                options={
                                                    detailModel.supportedImageReasoningEfforts ?? []
                                                }
                                                onChange={(effort) =>
                                                    setImageReasoningEffortOverride(
                                                        detailModel.id,
                                                        effort
                                                    )
                                                }
                                            />
                                        )}
                                    {detailModel.supportsTransparentBackground && (
                                        <ModelSettingTabs
                                            label="Background"
                                            value={
                                                transparentBackgroundModelIds.includes(
                                                    detailModel.id
                                                )
                                                    ? "transparent"
                                                    : "opaque"
                                            }
                                            options={BACKGROUND_OPTIONS}
                                            onChange={(background) =>
                                                setModelTransparentBackground(
                                                    detailModel.id,
                                                    background === "transparent"
                                                )
                                            }
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sticky bar: the column scrolls under it, so it is glass. */}
                <div className="glass-header glass-sidebar absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 border-[color:var(--glass-edge)] border-t px-4 py-3">
                    {isDevMode && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => confirmReferencesThenRun(handleFakeGenerate)}
                            disabled={!canSubmitGeneration}
                            className="h-10 shrink-0 bg-glass-control px-3 hover:bg-glass-control-hover dark:hover:bg-glass-control-hover"
                        >
                            {generationMode === "fake" && <Loader2 className="animate-spin" />}
                            Fake
                        </Button>
                    )}
                    <Button
                        type="button"
                        onClick={() => confirmReferencesThenRun(handleGenerate)}
                        disabled={disabled || !canSubmitGeneration}
                        className="h-10 min-w-0 flex-1"
                    >
                        {generationMode === "real" ? (
                            <>
                                <Loader2 className="animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles />
                                {totalRequestedGenerations > 1
                                    ? `Generate ${totalRequestedGenerations} images`
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
            <AlertDialog
                open={staleReferencesRun !== null}
                onOpenChange={(open) => {
                    if (!open) setStaleReferencesRun(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Still using these references?</AlertDialogTitle>
                        <AlertDialogDescription>
                            These references haven't been used in over a day. Remove them if they're
                            left over from an earlier session.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-wrap gap-2">
                        {references.map((reference) => (
                            <AttachmentTile
                                key={reference.sourceHash}
                                fileName="Reference image"
                                nativeTitle={false}
                                previewUrl={getReferencePreviewSrc(reference)}
                            />
                        ))}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() => {
                                const run = staleReferencesRun
                                const store = useLibraryReferencesStore.getState()
                                releaseReferenceUploads(
                                    store.references.map((reference) => reference.storageKey)
                                )
                                store.clearReferences()
                                if (run) void run()
                            }}
                        >
                            Remove and generate
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                const run = staleReferencesRun
                                useLibraryReferencesStore.getState().touchReferences()
                                if (run) void run()
                            }}
                        >
                            Generate with references
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

// One setting on a model's page: the same label-over-segments shape as the
// run's aspect ratio and resolution.
function ModelSettingTabs<Option extends string>({
    label,
    value,
    options,
    onChange
}: {
    label: string
    value: Option | undefined
    options: readonly Option[]
    onChange: (option: Option) => void
}) {
    return (
        <section className="flex flex-col gap-2">
            <h3 className={SECTION_LABEL_CLASS}>{label}</h3>
            <Tabs
                value={value}
                onValueChange={(nextValue) => {
                    const option = options.find((candidate) => candidate === nextValue)
                    if (option) onChange(option)
                }}
            >
                <TabsList className={cn("h-8 w-full", SIDEBAR_TABS_CLASS)} aria-label={label}>
                    {options.map((option) => (
                        <TabsTrigger
                            key={option}
                            value={option}
                            className="px-2 text-xs capitalize"
                        >
                            {option}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
        </section>
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
            <span className="text-muted-foreground text-xs">{label}</span>
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
