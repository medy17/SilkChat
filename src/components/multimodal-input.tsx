import { SupermemoryIcon } from "@/components/brand-icons"
import { ModelSelector } from "@/components/model-selector"
import { PersonaSelector } from "@/components/persona-selector"
import {
    PromptInput,
    PromptInputAction,
    PromptInputActions,
    type PromptInputRef,
    PromptInputTextarea
} from "@/components/prompt-kit/prompt-input"
import { ToolSelectorPopover } from "@/components/tool-selector-popover"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { VoiceRecorder } from "@/components/voice-recorder"
import { api } from "@/convex/_generated/api"
import type { SharedModel } from "@/convex/lib/models"
import { useSession, useToken } from "@/hooks/auth-hooks"
import { useIsMobile } from "@/hooks/use-mobile"
import { useUploadPolicy } from "@/hooks/use-upload-policy"
import { useVoiceRecorder } from "@/hooks/use-voice-recorder"
import {
    getAttachmentValidationError,
    hasPdfAttachmentInUploadedFiles
} from "@/lib/attachment-support"
import { resolveJwtToken } from "@/lib/auth-token"
import { browserEnv, optionalBrowserEnv } from "@/lib/browser-env"
import {
    type UploadedFileWithSource,
    prepareChatAttachmentForUpload,
    readChatAttachmentContent,
    uploadChatAttachment
} from "@/lib/chat-attachments"
import { type UploadedFile, useChatStore } from "@/lib/chat-store"
import { getChatWidthClass, useChatWidthStore } from "@/lib/chat-width-store"
import { useDiskCachedQuery } from "@/lib/convex-cached-query"
import { DefaultSettings } from "@/lib/default-user-settings"
import {
    estimateTokenCount,
    getFileAcceptAttribute,
    getFileTypeInfo,
    isImageMimeType,
    isSvgExtension,
    isSvgMimeType
} from "@/lib/file_constants"
import {
    IMAGE_RESOLUTION_OPTIONS,
    type ImageDefaultResolution,
    MAX_DEFAULT_VARIANTS
} from "@/lib/image-generation-defaults"
import { useModelStore } from "@/lib/model-store"
import {
    getAllowedReasoningEffortsForModel,
    getPrototypeCreditTierForModel,
    getReasoningEffortForPlan,
    getReasoningEffortIcon,
    getReasoningEffortLabelForModel,
    getRequiredPlanToPickModel,
    isInstantReasoningEffortForModel,
    resolveSelectedDisplayModel
} from "@/lib/models-providers-shared"
import { resolveMultimodalSubmitAction } from "@/lib/multimodal-submit-action"
import { hasPendingImageGeneration } from "@/lib/pending-image-generation"
import { appendQuotedSelection } from "@/lib/quote-selection"
import { useSharedModels } from "@/lib/shared-models"
import type { AbilityId } from "@/lib/tool-abilities"
import {
    DEFAULT_TOOL_CALL_LIMIT_PER_TURN,
    MAX_TOOL_CALL_LIMIT_PER_TURN,
    MIN_TOOL_CALL_LIMIT_PER_TURN,
    clampToolCallLimitPerTurn
} from "@/lib/tool-call-limit"
import { cn } from "@/lib/utils"
import type { useChat } from "@ai-sdk/react"
import { useConvexMutation } from "@convex-dev/react-query"
import type { UIMessage } from "ai"
import { useConvexAuth, useMutation } from "convex/react"
import {
    ArrowUp,
    Check,
    ChevronDown,
    ChevronUp,
    Code,
    Crown,
    FileType,
    Globe,
    Image as ImageIcon,
    Loader2,
    Mic,
    Minus,
    MoreHorizontal,
    Paperclip,
    Plus,
    Square,
    X
} from "lucide-react"
import { motion } from "motion/react"
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState
} from "react"
import { toast } from "sonner"

type ExtendedUploadedFile = UploadedFileWithSource

const DEFAULT_MODEL_CONTEXT_LENGTH = 128_000
const DEFAULT_MAX_OUTPUT_TOKENS = 16_096
const DEFAULT_HOSTED_CONTEXT_MAX_INPUT_COST_USD = 0.75
const DEFAULT_HOSTED_CONTEXT_FALLBACK_INPUT_TOKENS = 32_000
const DEFAULT_HOSTED_CONTEXT_MAX_INPUT_TOKENS = 128_000
const DEFAULT_CONTEXT_FILE_REFERENCE_TOKENS = 256
const DEFAULT_MESSAGE_OVERHEAD_TOKENS = 4
const COMPOSER_CONTEXT_WARNING_CONFIDENCE_MULTIPLIER = 1.1

/**
 * Decide whether to surface the model-selector context hint for an approaching
 * overage. We only nudge about hosted/BYOK once the user's OpenRouter key is set
 * up — then the hint reassures them the long request will run on their key. With
 * no key we stay quiet and let the send fail with the actionable rejection
 * instead of pre-warning about a BYOK setup they haven't done. The model-limit
 * case is BYOK-independent (no key can fix it), so it always shows.
 */
const resolveByokContextHint = (
    routing: { exceedsModelLimit: boolean; openRouterByokEnabled: boolean } | null
): { tooltip: string; ariaLabel: string } | undefined => {
    if (!routing) return undefined
    if (routing.exceedsModelLimit) {
        return {
            tooltip:
                "This request may exceed the selected model's context limit. Shorten it or start a new chat.",
            ariaLabel: "May exceed the model's context limit"
        }
    }
    if (routing.openRouterByokEnabled) {
        return {
            tooltip: "This request exceeds hosted limits and will run on your OpenRouter key.",
            ariaLabel: "Will use your OpenRouter key"
        }
    }
    return undefined
}

interface LocalUploadingFile {
    id: string
    file: File
    progress: number
    status: "uploading" | "success" | "error"
    previewUrl?: string
    error?: string
}

const isPositiveFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0

const resolveComposerContextLimits = (model: SharedModel | undefined) => {
    const modelContextLength = isPositiveFiniteNumber(model?.contextLength)
        ? model.contextLength
        : DEFAULT_MODEL_CONTEXT_LENGTH
    const maxOutputTokens = isPositiveFiniteNumber(model?.maxTokens)
        ? model.maxTokens
        : DEFAULT_MAX_OUTPUT_TOKENS
    const safetyMarginTokens = Math.max(4_096, Math.ceil(modelContextLength * 0.05))
    const modelInputLimit = Math.max(
        1_024,
        modelContextLength - maxOutputTokens - safetyMarginTokens
    )
    const configuredHostedLimit = isPositiveFiniteNumber(model?.hostedContextLength)
        ? model.hostedContextLength
        : undefined
    const hostedMetadataLimit = configuredHostedLimit ?? DEFAULT_HOSTED_CONTEXT_MAX_INPUT_TOKENS
    const priceDerivedHostedLimit = isPositiveFiniteNumber(model?.inputUsdPer1MTokens)
        ? Math.floor(
              (DEFAULT_HOSTED_CONTEXT_MAX_INPUT_COST_USD * 1_000_000) / model.inputUsdPer1MTokens
          )
        : undefined
    const hostedInputLimit = Math.max(
        1_024,
        Math.min(
            modelInputLimit,
            hostedMetadataLimit,
            priceDerivedHostedLimit ??
                configuredHostedLimit ??
                DEFAULT_HOSTED_CONTEXT_FALLBACK_INPUT_TOKENS
        )
    )

    return { modelInputLimit, hostedInputLimit }
}

const estimateUiMessageTokens = (message: UIMessage) =>
    message.parts.reduce((total, part) => {
        if (part.type === "text") return total + estimateTokenCount(part.text)
        if (part.type === "reasoning") return total + estimateTokenCount(part.text ?? "")
        if (part.type === "file") {
            return (
                total +
                DEFAULT_CONTEXT_FILE_REFERENCE_TOKENS +
                estimateTokenCount(part.filename ?? "") +
                estimateTokenCount(part.mediaType ?? "")
            )
        }
        if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
            return total + estimateTokenCount(JSON.stringify(part))
        }
        return total
    }, DEFAULT_MESSAGE_OVERHEAD_TOKENS)

const estimateUploadedFileTokens = (
    file: UploadedFile,
    content: string | undefined,
    contentAvailable: boolean
) => {
    const baseTokens =
        DEFAULT_CONTEXT_FILE_REFERENCE_TOKENS +
        estimateTokenCount(file.fileName) +
        estimateTokenCount(file.fileType)

    if (contentAvailable) {
        return baseTokens + estimateTokenCount(content ?? "")
    }

    const fileTypeInfo = getFileTypeInfo(file.fileName, file.fileType)
    if (fileTypeInfo.isText && !fileTypeInfo.isImage) {
        return baseTokens + Math.ceil(file.fileSize / 4)
    }

    return baseTokens
}

export const ReasoningEffortSelector = ({
    selectedModel,
    tone = "default",
    creditPlan
}: {
    selectedModel: string | null
    tone?: "default" | "on-primary"
    creditPlan?: CreditPlan | null
}) => {
    const { reasoningEffort, setReasoningEffort } = useModelStore()
    const { models: sharedModels } = useSharedModels()
    const loadedCreditPlan = usePrototypeCreditPlan(creditPlan === undefined)
    const resolvedCreditPlan = creditPlan === undefined ? loadedCreditPlan : creditPlan

    const selectedSharedModel = useMemo(
        () => sharedModels.find((model) => model.id === selectedModel),
        [selectedModel, sharedModels]
    )
    const allowedEfforts = useMemo(
        () => getAllowedReasoningEffortsForModel(selectedSharedModel),
        [selectedSharedModel]
    )
    const modelSupportsReasoningControl = allowedEfforts.length > 0

    useEffect(() => {
        if (!modelSupportsReasoningControl) return
        const resolvedEffort = getReasoningEffortForPlan(
            selectedSharedModel,
            reasoningEffort,
            resolvedCreditPlan
        )
        if (resolvedEffort && resolvedEffort !== reasoningEffort) {
            setReasoningEffort(resolvedEffort)
        }
    }, [
        modelSupportsReasoningControl,
        reasoningEffort,
        resolvedCreditPlan,
        selectedSharedModel,
        setReasoningEffort
    ])
    const isReasoningOff = isInstantReasoningEffortForModel(selectedSharedModel, reasoningEffort)
    const selectedModelBaseUsesProCredits =
        selectedSharedModel !== undefined &&
        getPrototypeCreditTierForModel(selectedSharedModel, "off") === "pro"
    const selectedEffortUsesProCredits =
        resolvedCreditPlan === "pro" &&
        selectedSharedModel !== undefined &&
        !selectedModelBaseUsesProCredits &&
        getPrototypeCreditTierForModel(selectedSharedModel, reasoningEffort) === "pro"
    const reasoningLabel = getReasoningEffortLabelForModel(selectedSharedModel, reasoningEffort)
    const ReasoningIcon = getReasoningEffortIcon(reasoningEffort, selectedSharedModel)

    if (!modelSupportsReasoningControl) return null

    return (
        <PromptInputAction tooltip="Select reasoning effort">
            <Select value={reasoningEffort} onValueChange={setReasoningEffort}>
                <SelectTrigger
                    className={cn(
                        "!h-8 w-auto gap-0.5 px-1.5 font-normal text-xs transition-colors sm:text-sm",
                        tone === "on-primary"
                            ? isReasoningOff
                                ? "border border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                                : "border border-primary-foreground/20 bg-primary-foreground text-primary hover:bg-primary-foreground/90 hover:text-primary"
                            : "border-0 bg-secondary/70 backdrop-blur-lg hover:bg-accent"
                    )}
                >
                    <div className="hidden items-center gap-1.5 sm:flex">
                        <ReasoningIcon className="size-4" />
                        {selectedEffortUsesProCredits && (
                            <Crown className="size-3.5 shrink-0" aria-label="Uses Pro credits" />
                        )}
                        <span>{reasoningLabel}</span>
                    </div>
                    <span className="flex items-center gap-1 sm:hidden">
                        <ReasoningIcon className="size-4" />
                        {selectedEffortUsesProCredits && (
                            <Crown className="size-2.5 shrink-0" aria-label="Uses Pro credits" />
                        )}
                    </span>
                </SelectTrigger>
                <SelectContent>
                    {allowedEfforts.map((effort) => {
                        const EffortIcon = getReasoningEffortIcon(effort, selectedSharedModel)
                        const isEffortLocked =
                            resolvedCreditPlan === "free" &&
                            selectedSharedModel !== undefined &&
                            getRequiredPlanToPickModel(selectedSharedModel, effort) === "pro"
                        const effortUsesProCredits =
                            resolvedCreditPlan === "pro" &&
                            selectedSharedModel !== undefined &&
                            !selectedModelBaseUsesProCredits &&
                            getPrototypeCreditTierForModel(selectedSharedModel, effort) === "pro"

                        return (
                            <SelectItem
                                key={effort}
                                value={effort}
                                disabled={isEffortLocked}
                                className="text-xs sm:text-sm"
                            >
                                <span className="flex w-full items-center justify-between gap-3">
                                    <span className="flex items-center gap-2">
                                        <EffortIcon className="size-4 shrink-0" />
                                        <span>
                                            {getReasoningEffortLabelForModel(
                                                selectedSharedModel,
                                                effort
                                            )}
                                        </span>
                                    </span>
                                    {isEffortLocked && (
                                        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-[0.625rem] text-primary uppercase">
                                            Pro
                                        </span>
                                    )}
                                    {effortUsesProCredits && (
                                        <Crown
                                            className="size-3.5 shrink-0"
                                            aria-label="Uses Pro credits"
                                        />
                                    )}
                                </span>
                            </SelectItem>
                        )
                    })}
                </SelectContent>
            </Select>
        </PromptInputAction>
    )
}

export interface MultimodalInputRef {
    handleFileUpload: (files: File[]) => Promise<void>
    setValue: (value: string) => void
    insertQuote: (selection: string) => void
}

const mobileMenuRowClassName =
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/60"

type CreditPlan = "free" | "pro"

const usePrototypeCreditPlan = (enabled = true) => {
    const session = useSession()
    const auth = useConvexAuth()
    const [creditPlan, setCreditPlan] = useState<CreditPlan | null>(null)

    useEffect(() => {
        if (!enabled || !session.user?.id || auth.isLoading) {
            setCreditPlan(null)
            return
        }

        let cancelled = false

        const loadCreditPlan = async () => {
            try {
                const response = await fetch("/api/credit-summary", {
                    credentials: "include"
                })

                if (!response.ok) {
                    throw new Error("Failed to load credit summary")
                }

                const data = (await response.json()) as { plan?: CreditPlan }
                if (!cancelled) {
                    setCreditPlan(data.plan === "pro" ? "pro" : "free")
                }
            } catch {
                if (!cancelled) {
                    setCreditPlan("free")
                }
            }
        }

        void loadCreditPlan()

        return () => {
            cancelled = true
        }
    }, [auth.isLoading, enabled, session.user?.id])

    return creditPlan
}

function MobileMenuIcon({
    slashed = false,
    children
}: {
    slashed?: boolean
    children: React.ReactNode
}) {
    return (
        <span className="relative flex size-4 shrink-0 items-center justify-center">
            {children}
            {slashed && (
                <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 h-px w-[1.15rem] rotate-[-42deg] bg-current" />
            )}
        </span>
    )
}

function MobileOverflowMenu({
    open,
    onOpenChange,
    selectedModel,
    modelSupportsVision,
    modelSupportsFunctionCalling,
    modelSupportsReasoningControl,
    isImageModel,
    allowedReasoningEfforts,
    selectedSharedModel,
    creditPlan,
    webSearchAvailable,
    hasSupermemory,
    mcpServers,
    currentMcpOverrides,
    toolCallLimitPerTurn,
    toolLimitInteractive,
    onSetToolCallLimit,
    imageDefaultResolution,
    imageDefaultVariants,
    onSetImageDefaults,
    onToggleTool,
    onToggleMcpServer,
    onAttachClick
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedModel: string | null
    modelSupportsVision: boolean
    modelSupportsFunctionCalling: boolean
    modelSupportsReasoningControl: boolean
    isImageModel: boolean
    allowedReasoningEfforts: ReturnType<typeof getAllowedReasoningEffortsForModel>
    selectedSharedModel?: SharedModel
    creditPlan: CreditPlan | null
    webSearchAvailable: boolean
    hasSupermemory: boolean
    mcpServers: Array<{ name: string }>
    currentMcpOverrides: Record<string, boolean>
    toolCallLimitPerTurn: number
    toolLimitInteractive: boolean
    onSetToolCallLimit: (nextLimit: number) => void
    imageDefaultResolution: ImageDefaultResolution
    imageDefaultVariants: number
    onSetImageDefaults: (partial: {
        resolution?: ImageDefaultResolution
        variants?: number
    }) => void
    onToggleTool: (tool: AbilityId) => void
    onToggleMcpServer: (serverName: string) => void
    onAttachClick: () => void
}) {
    const { enabledTools, reasoningEffort, setReasoningEffort } = useModelStore()
    const [reasoningExpanded, setReasoningExpanded] = useState(false)
    const reasoningLabel = getReasoningEffortLabelForModel(selectedSharedModel, reasoningEffort)
    const ReasoningIcon = getReasoningEffortIcon(reasoningEffort, selectedSharedModel)
    const selectedModelBaseUsesProCredits =
        selectedSharedModel !== undefined &&
        getPrototypeCreditTierForModel(selectedSharedModel, "off") === "pro"
    const selectedEffortUsesProCredits =
        creditPlan === "pro" &&
        selectedSharedModel !== undefined &&
        !selectedModelBaseUsesProCredits &&
        getPrototypeCreditTierForModel(selectedSharedModel, reasoningEffort) === "pro"
    const webSearchEnabled = enabledTools.includes("web_search")
    const supermemoryEnabled = enabledTools.includes("supermemory")
    const hasMcpServers = mcpServers.length > 0

    useEffect(() => {
        if (!open) {
            setReasoningExpanded(false)
        }
    }, [open])

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-md bg-secondary/70 text-foreground backdrop-blur-lg hover:bg-secondary/80"
                >
                    <MoreHorizontal className="size-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                side="top"
                sideOffset={8}
                className="max-h-[min(var(--radix-popover-content-available-height),calc(100dvh-1rem))] w-[min(16rem,calc(100vw-1rem))] overflow-y-auto overscroll-contain border-border/70 bg-popover p-1.5 shadow-lg"
                style={{ borderRadius: "var(--radius-lg)" }}
            >
                <div className="space-y-1">
                    {modelSupportsReasoningControl && (
                        <>
                            <button
                                type="button"
                                className={mobileMenuRowClassName}
                                onClick={() => setReasoningExpanded((expanded) => !expanded)}
                            >
                                <ReasoningIcon className="size-4 shrink-0" />
                                {selectedEffortUsesProCredits && (
                                    <Crown
                                        className="size-3.5 shrink-0"
                                        aria-label="Uses Pro credits"
                                    />
                                )}
                                <span className="min-w-0 flex-1 truncate">
                                    Reasoning: {reasoningLabel}
                                </span>
                                {reasoningExpanded ? (
                                    <ChevronUp className="size-4 shrink-0" />
                                ) : (
                                    <ChevronDown className="size-4 shrink-0" />
                                )}
                            </button>
                            {reasoningExpanded && (
                                <div className="space-y-1 px-2 pb-1">
                                    {allowedReasoningEfforts.map((effort) => {
                                        const EffortIcon = getReasoningEffortIcon(
                                            effort,
                                            selectedSharedModel
                                        )
                                        const effortLabel = getReasoningEffortLabelForModel(
                                            selectedSharedModel,
                                            effort
                                        )
                                        const isSelected = reasoningEffort === effort
                                        const isEffortLocked =
                                            creditPlan === "free" &&
                                            selectedSharedModel !== undefined &&
                                            getRequiredPlanToPickModel(
                                                selectedSharedModel,
                                                effort
                                            ) === "pro"
                                        const effortUsesProCredits =
                                            creditPlan === "pro" &&
                                            selectedSharedModel !== undefined &&
                                            !selectedModelBaseUsesProCredits &&
                                            getPrototypeCreditTierForModel(
                                                selectedSharedModel,
                                                effort
                                            ) === "pro"

                                        return (
                                            <button
                                                key={effort}
                                                type="button"
                                                className={cn(
                                                    "flex w-full items-center gap-2 rounded-md px-9 py-2 text-left text-sm transition-colors hover:bg-accent/60",
                                                    isSelected && "bg-accent/50 text-primary",
                                                    isEffortLocked &&
                                                        "cursor-not-allowed opacity-50 hover:bg-transparent"
                                                )}
                                                disabled={isEffortLocked}
                                                onClick={() => setReasoningEffort(effort)}
                                            >
                                                <EffortIcon className="size-4 shrink-0" />
                                                <span className="min-w-0 flex-1 truncate">
                                                    {effortLabel}
                                                </span>
                                                {isEffortLocked && (
                                                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-[0.625rem] text-primary uppercase">
                                                        Pro
                                                    </span>
                                                )}
                                                {effortUsesProCredits && (
                                                    <Crown
                                                        className="size-3.5 shrink-0"
                                                        aria-label="Uses Pro credits"
                                                    />
                                                )}
                                                {isSelected && (
                                                    <Check className="size-4 shrink-0" />
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {!isImageModel && (
                        <button
                            type="button"
                            className={cn(
                                mobileMenuRowClassName,
                                (!modelSupportsVision || !modelSupportsFunctionCalling) &&
                                    "cursor-not-allowed opacity-50"
                            )}
                            disabled={!modelSupportsVision || !modelSupportsFunctionCalling}
                        >
                            <ImageIcon className="size-4 shrink-0" />
                            <span className="min-w-0 flex-1 truncate">
                                SilkScreen{" "}
                                {modelSupportsVision && modelSupportsFunctionCalling
                                    ? "available"
                                    : "unavailable"}
                            </span>
                        </button>
                    )}

                    {!isImageModel && (
                        <button
                            type="button"
                            className={cn(
                                mobileMenuRowClassName,
                                (!modelSupportsFunctionCalling || !webSearchAvailable) &&
                                    "cursor-not-allowed opacity-50"
                            )}
                            disabled={!modelSupportsFunctionCalling || !webSearchAvailable}
                            onClick={() => onToggleTool("web_search")}
                        >
                            <MobileMenuIcon slashed={!webSearchEnabled}>
                                <Globe className="size-4" />
                            </MobileMenuIcon>
                            <span className="min-w-0 flex-1 truncate">
                                Search {webSearchEnabled ? "enabled" : "disabled"}
                            </span>
                        </button>
                    )}

                    {!isImageModel && (
                        <button
                            type="button"
                            className={cn(
                                mobileMenuRowClassName,
                                !hasSupermemory && "cursor-not-allowed opacity-50"
                            )}
                            disabled={!hasSupermemory}
                            onClick={() => onToggleTool("supermemory")}
                        >
                            <MobileMenuIcon slashed={!supermemoryEnabled}>
                                <SupermemoryIcon />
                            </MobileMenuIcon>
                            <span className="min-w-0 flex-1 truncate">
                                Supermemory {supermemoryEnabled ? "enabled" : "disabled"}
                            </span>
                        </button>
                    )}

                    {!isImageModel && (
                        <button
                            type="button"
                            className={mobileMenuRowClassName}
                            onClick={() => {
                                onOpenChange(false)
                                onAttachClick()
                            }}
                        >
                            <Paperclip className="size-4 shrink-0" />
                            <span className="min-w-0 flex-1 truncate">Attach</span>
                        </button>
                    )}

                    {!isImageModel && (
                        <div className="border-border/60 border-t pt-2">
                            <p className="px-2.5 pb-1 font-medium text-[0.6875rem] text-muted-foreground uppercase tracking-[0.16em]">
                                MCP Servers
                            </p>
                            <div className="space-y-1">
                                {hasMcpServers ? (
                                    mcpServers.map((server) => {
                                        const isEnabled = currentMcpOverrides[server.name] !== false

                                        return (
                                            <button
                                                key={server.name}
                                                type="button"
                                                className={mobileMenuRowClassName}
                                                onClick={() => onToggleMcpServer(server.name)}
                                            >
                                                <span className="min-w-0 flex-1 truncate">
                                                    {server.name}{" "}
                                                    {isEnabled ? "enabled" : "disabled"}
                                                </span>
                                            </button>
                                        )
                                    })
                                ) : (
                                    <button
                                        type="button"
                                        className={cn(
                                            mobileMenuRowClassName,
                                            "cursor-not-allowed opacity-50"
                                        )}
                                        disabled
                                    >
                                        <span className="min-w-0 flex-1 truncate">
                                            MCP Servers disabled
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {!isImageModel && (
                        <div className="border-border/60 border-t pt-2">
                            <p className="px-2.5 pb-1 font-medium text-[0.6875rem] text-muted-foreground uppercase tracking-[0.16em]">
                                Image Defaults
                            </p>
                            <div
                                className={cn(
                                    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                                    !(modelSupportsVision && modelSupportsFunctionCalling) &&
                                        "cursor-not-allowed opacity-50"
                                )}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="truncate">Resolution</div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {IMAGE_RESOLUTION_OPTIONS.map((option) => {
                                        const isActive = imageDefaultResolution === option
                                        return (
                                            <button
                                                key={option}
                                                type="button"
                                                disabled={
                                                    !(
                                                        modelSupportsVision &&
                                                        modelSupportsFunctionCalling
                                                    )
                                                }
                                                className={cn(
                                                    "flex h-6 min-w-9 items-center justify-center rounded border px-2 text-xs tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                                                    isActive
                                                        ? "border-primary bg-primary text-primary-foreground"
                                                        : "border-border/60 text-foreground hover:bg-muted/60"
                                                )}
                                                onClick={() =>
                                                    onSetImageDefaults({ resolution: option })
                                                }
                                            >
                                                {option}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div
                                className={cn(
                                    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                                    !(modelSupportsVision && modelSupportsFunctionCalling) &&
                                        "cursor-not-allowed opacity-50"
                                )}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="truncate">Variants</div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        className="flex h-6 w-6 items-center justify-center rounded border border-border/60 text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                                        disabled={
                                            !(
                                                modelSupportsVision && modelSupportsFunctionCalling
                                            ) || imageDefaultVariants <= 1
                                        }
                                        onClick={() =>
                                            onSetImageDefaults({
                                                variants: Math.max(1, imageDefaultVariants - 1)
                                            })
                                        }
                                    >
                                        <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="min-w-8 text-center font-medium text-foreground text-xs">
                                        {imageDefaultVariants}
                                    </span>
                                    <button
                                        type="button"
                                        className="flex h-6 w-6 items-center justify-center rounded border border-border/60 text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                                        disabled={
                                            !(
                                                modelSupportsVision && modelSupportsFunctionCalling
                                            ) || imageDefaultVariants >= MAX_DEFAULT_VARIANTS
                                        }
                                        onClick={() =>
                                            onSetImageDefaults({
                                                variants: Math.min(
                                                    MAX_DEFAULT_VARIANTS,
                                                    imageDefaultVariants + 1
                                                )
                                            })
                                        }
                                    >
                                        <Plus className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isImageModel && (
                        <div className="border-border/60 border-t pt-2">
                            <p className="px-2.5 pb-1 font-medium text-[0.6875rem] text-muted-foreground uppercase tracking-[0.16em]">
                                Limits
                            </p>
                            <div
                                className={cn(
                                    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/60",
                                    !toolLimitInteractive && "cursor-not-allowed opacity-50"
                                )}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="truncate">Tool Calls</div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        className="flex h-6 w-6 items-center justify-center rounded border border-border/60 text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                                        disabled={
                                            !toolLimitInteractive ||
                                            toolCallLimitPerTurn <= MIN_TOOL_CALL_LIMIT_PER_TURN
                                        }
                                        onClick={() =>
                                            onSetToolCallLimit(
                                                Math.max(
                                                    MIN_TOOL_CALL_LIMIT_PER_TURN,
                                                    toolCallLimitPerTurn - 1
                                                )
                                            )
                                        }
                                    >
                                        <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="min-w-8 text-center font-medium text-foreground text-xs">
                                        {toolCallLimitPerTurn || DEFAULT_TOOL_CALL_LIMIT_PER_TURN}
                                    </span>
                                    <button
                                        type="button"
                                        className="flex h-6 w-6 items-center justify-center rounded border border-border/60 text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                                        disabled={
                                            !toolLimitInteractive ||
                                            toolCallLimitPerTurn >= MAX_TOOL_CALL_LIMIT_PER_TURN
                                        }
                                        onClick={() =>
                                            onSetToolCallLimit(
                                                Math.min(
                                                    MAX_TOOL_CALL_LIMIT_PER_TURN,
                                                    toolCallLimitPerTurn + 1
                                                )
                                            )
                                        }
                                    >
                                        <Plus className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

export function useComposerToolbarState(threadId?: string) {
    const session = useSession()
    const auth = useConvexAuth()
    const { models: sharedModels } = useSharedModels()
    const creditPlan = usePrototypeCreditPlan()
    const {
        selectedModel,
        enabledTools,
        setEnabledTools,
        reasoningEffort,
        setReasoningEffort,
        mcpOverrides,
        defaultMcpOverrides,
        setMcpOverride,
        setDefaultMcpOverride
    } = useModelStore()

    const [pendingToolCallLimitPerTurn, setPendingToolCallLimitPerTurn] = useState<number | null>(
        null
    )

    const userSettings = useDiskCachedQuery(
        api.settings.getUserSettings,
        {
            key: "user-settings",
            default: DefaultSettings(session.user?.id ?? "CACHE"),
            forceCache: true
        },
        session.user?.id && !auth.isLoading ? {} : "skip"
    )
    const toolAvailability = useDiskCachedQuery(
        api.settings.getToolAvailability,
        {
            key: "tool-availability",
            default: null,
            forceCache: true
        },
        session.user?.id && !auth.isLoading ? {} : "skip"
    )
    const updateUserSettings = useConvexMutation(api.settings.updateUserSettingsPartial)

    const customModels = "error" in userSettings ? undefined : userSettings.customModels
    const selectedDisplayModel = useMemo(
        () => resolveSelectedDisplayModel(selectedModel, sharedModels, customModels),
        [customModels, selectedModel, sharedModels]
    )
    const selectedSharedModel =
        selectedDisplayModel && !("isCustom" in selectedDisplayModel)
            ? selectedDisplayModel
            : undefined
    const allowedReasoningEfforts = useMemo(
        () => getAllowedReasoningEffortsForModel(selectedSharedModel),
        [selectedSharedModel]
    )
    const modelSupportsReasoningControl = allowedReasoningEfforts.length > 0

    const [
        modelSupportsVision,
        modelSupportsFunctionCalling,
        modelSupportsNativePdf,
        isImageModel
    ] = useMemo(() => {
        if (!selectedModel) return [false, false, false, false]
        return [
            selectedDisplayModel?.abilities.includes("vision") ?? false,
            selectedDisplayModel?.abilities.includes("function_calling") ?? false,
            selectedDisplayModel?.abilities.includes("native_pdf") ?? false,
            selectedDisplayModel?.mode === "image"
        ]
    }, [selectedDisplayModel, selectedModel])

    useEffect(() => {
        if (!modelSupportsReasoningControl && reasoningEffort !== "off") {
            setReasoningEffort("off")
        }
    }, [modelSupportsReasoningControl, reasoningEffort, setReasoningEffort])

    const webSearchAvailable = Boolean(toolAvailability?.web_search.enabled)
    const hasSupermemory = Boolean(toolAvailability?.supermemory.enabled)
    const mcpServers = (userSettings.mcpServers || []).filter((server) => server.enabled !== false)
    const hasMcpServers = mcpServers.length > 0
    const invertSendNewlineBehavior =
        !("error" in userSettings) && userSettings.invertSendNewlineBehavior === true

    useEffect(() => {
        const unavailableTools = new Set<AbilityId>()
        if (!modelSupportsFunctionCalling || !webSearchAvailable) unavailableTools.add("web_search")
        if (!hasSupermemory) unavailableTools.add("supermemory")
        if (!hasMcpServers) unavailableTools.add("mcp")

        const nextEnabledTools = enabledTools.filter((tool) => !unavailableTools.has(tool))
        if (nextEnabledTools.length !== enabledTools.length) {
            setEnabledTools(nextEnabledTools)
        }
    }, [
        modelSupportsFunctionCalling,
        webSearchAvailable,
        hasSupermemory,
        hasMcpServers,
        enabledTools,
        setEnabledTools
    ])

    const currentMcpOverrides = threadId
        ? { ...defaultMcpOverrides, ...(mcpOverrides[threadId] || {}) }
        : { ...defaultMcpOverrides }
    const activeToolCount = [
        webSearchAvailable && enabledTools.includes("web_search"),
        hasSupermemory && enabledTools.includes("supermemory"),
        hasMcpServers && mcpServers.some((server) => currentMcpOverrides[server.name] !== false)
    ].filter(Boolean).length
    const toolLimitInteractive = activeToolCount > 0
    const effectiveToolCallLimitPerTurn = clampToolCallLimitPerTurn(
        userSettings.toolCallLimitPerTurn,
        { hasEnabledTools: toolLimitInteractive }
    )
    const displayedToolCallLimitPerTurn =
        pendingToolCallLimitPerTurn ?? effectiveToolCallLimitPerTurn

    const handleToolToggle = (tool: AbilityId) => {
        if (tool === "web_search" && (!modelSupportsFunctionCalling || !webSearchAvailable)) return
        if (tool === "supermemory" && !hasSupermemory) return
        if (tool === "mcp" && !hasMcpServers) return

        setEnabledTools(
            enabledTools.includes(tool)
                ? enabledTools.filter((enabledTool) => enabledTool !== tool)
                : [...enabledTools, tool]
        )
    }

    const handleMcpServerToggle = (serverName: string) => {
        const isEnabled = currentMcpOverrides[serverName] !== false

        if (threadId) {
            setMcpOverride(threadId, serverName, !isEnabled)
            return
        }

        setDefaultMcpOverride(serverName, !isEnabled)
    }

    useEffect(() => {
        if (
            pendingToolCallLimitPerTurn !== null &&
            pendingToolCallLimitPerTurn === effectiveToolCallLimitPerTurn
        ) {
            setPendingToolCallLimitPerTurn(null)
        }
    }, [effectiveToolCallLimitPerTurn, pendingToolCallLimitPerTurn])

    useEffect(() => {
        if (pendingToolCallLimitPerTurn === null) {
            return
        }

        const timeout = window.setTimeout(() => {
            void updateUserSettings({
                toolCallLimitPerTurn: pendingToolCallLimitPerTurn
            }).catch((error) => {
                setPendingToolCallLimitPerTurn(null)
                toast.error("Failed to update tool call limit")
                console.error(error)
            })
        }, 200)

        return () => window.clearTimeout(timeout)
    }, [pendingToolCallLimitPerTurn, updateUserSettings])

    const handleToolCallLimitUpdate = useCallback((nextLimit: number) => {
        setPendingToolCallLimitPerTurn(nextLimit)
    }, [])

    const imageDefaults = userSettings.imageGenerationDefaults
    const imageDefaultResolution: ImageDefaultResolution =
        (imageDefaults?.resolution as ImageDefaultResolution | undefined) ?? "1K"
    const imageDefaultVariants = imageDefaults?.variants ?? 1
    const handleImageDefaultsUpdate = useCallback(
        (partial: { resolution?: ImageDefaultResolution; variants?: number }) => {
            void updateUserSettings({ imageGenerationDefaults: partial }).catch((error) => {
                toast.error("Failed to update image defaults")
                console.error(error)
            })
        },
        [updateUserSettings]
    )

    return {
        selectedModel,
        creditPlan,
        userSettings,
        selectedSharedModel,
        allowedReasoningEfforts,
        modelSupportsReasoningControl,
        modelSupportsVision,
        modelSupportsFunctionCalling,
        modelSupportsNativePdf,
        isImageModel,
        webSearchAvailable,
        hasSupermemory,
        mcpServers,
        currentMcpOverrides,
        toolLimitInteractive,
        displayedToolCallLimitPerTurn,
        handleToolCallLimitUpdate,
        imageDefaultResolution,
        imageDefaultVariants,
        handleImageDefaultsUpdate,
        handleToolToggle,
        handleMcpServerToggle,
        invertSendNewlineBehavior
    }
}

export type ComposerToolbarState = ReturnType<typeof useComposerToolbarState>

export function ComposerDesktopActions({
    state,
    threadId,
    uploading,
    onAttachClick
}: {
    state: ComposerToolbarState
    threadId?: string
    uploading: boolean
    onAttachClick: () => void
}) {
    const { enabledTools, setEnabledTools } = useModelStore()

    return (
        <motion.div
            layout
            transition={{
                duration: 0.2,
                ease: [0.16, 1, 0.3, 1]
            }}
            className="hidden items-center gap-2 md:flex"
        >
            {state.isImageModel ? null : (
                <>
                    <PromptInputAction tooltip="Attach files">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onAttachClick}
                            disabled={uploading}
                            className="flex size-8 cursor-pointer items-center justify-center gap-1 bg-secondary/70 text-foreground backdrop-blur-lg hover:bg-secondary/80"
                            style={{ borderRadius: "var(--radius-md)" }}
                        >
                            {uploading ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Paperclip className="-rotate-45 size-4 hover:text-primary" />
                            )}
                        </Button>
                    </PromptInputAction>

                    <PromptInputAction tooltip="Tools">
                        <ToolSelectorPopover
                            threadId={threadId}
                            enabledTools={enabledTools}
                            onEnabledToolsChange={setEnabledTools}
                            modelSupportsFunctionCalling={state.modelSupportsFunctionCalling}
                            modelSupportsVision={state.modelSupportsVision}
                        />
                    </PromptInputAction>

                    <ReasoningEffortSelector
                        selectedModel={state.selectedModel}
                        creditPlan={state.creditPlan}
                    />
                </>
            )}
        </motion.div>
    )
}

export function ComposerMobileMenu({
    state,
    onAttachClick
}: {
    state: ComposerToolbarState
    onAttachClick: () => void
}) {
    const [open, setOpen] = useState(false)

    if (state.isImageModel && !state.modelSupportsReasoningControl) {
        return null
    }

    return (
        <div className="shrink-0 md:hidden">
            <MobileOverflowMenu
                open={open}
                onOpenChange={setOpen}
                selectedModel={state.selectedModel}
                modelSupportsVision={state.modelSupportsVision}
                modelSupportsFunctionCalling={state.modelSupportsFunctionCalling}
                modelSupportsReasoningControl={state.modelSupportsReasoningControl}
                isImageModel={state.isImageModel}
                allowedReasoningEfforts={state.allowedReasoningEfforts}
                selectedSharedModel={state.selectedSharedModel}
                creditPlan={state.creditPlan}
                webSearchAvailable={state.webSearchAvailable}
                hasSupermemory={state.hasSupermemory}
                mcpServers={state.mcpServers}
                currentMcpOverrides={state.currentMcpOverrides}
                toolCallLimitPerTurn={state.displayedToolCallLimitPerTurn}
                toolLimitInteractive={state.toolLimitInteractive}
                onSetToolCallLimit={state.handleToolCallLimitUpdate}
                imageDefaultResolution={state.imageDefaultResolution}
                imageDefaultVariants={state.imageDefaultVariants}
                onSetImageDefaults={state.handleImageDefaultsUpdate}
                onToggleTool={state.handleToolToggle}
                onToggleMcpServer={state.handleMcpServerToggle}
                onAttachClick={onAttachClick}
            />
        </div>
    )
}

export const MultimodalInput = forwardRef<
    MultimodalInputRef,
    {
        onSubmit: (input?: string, files?: UploadedFile[]) => void
        status: ReturnType<typeof useChat>["status"]
        threadId?: string
        isActive?: boolean
        threadHasPdfAttachments?: boolean
        messages?: UIMessage[]
    }
>(function MultimodalInput(
    { onSubmit, status, threadId, isActive = true, threadHasPdfAttachments = false, messages = [] },
    ref
) {
    const { token } = useToken()
    const session = useSession()
    const auth = useConvexAuth()
    const deleteFileMutation = useMutation(api.attachments.deleteFile)
    const { policy: uploadPolicy, policyVersion, invalidateUploadPolicy } = useUploadPolicy()
    const isMobile = useIsMobile()
    const composerToolbar = useComposerToolbarState(threadId)
    const {
        userSettings,
        selectedSharedModel,
        modelSupportsVision,
        modelSupportsNativePdf,
        isImageModel,
        invertSendNewlineBehavior
    } = composerToolbar

    const { selectedModel, setSelectedModel } = useModelStore()
    const { uploadedFiles, addUploadedFile, removeUploadedFile, uploading, setUploading } =
        useChatStore()
    const { chatWidthState } = useChatWidthStore()

    const isLoading = status === "streaming"
    const isImageGenerationPending = useMemo(() => hasPendingImageGeneration(messages), [messages])
    // One-shot escape hatch: "Send anyway" on the gate toast arms this for a single
    // submit so a generation stuck in a non-terminal status can never lock the thread.
    const imageGenerationGateBypassRef = useRef(false)
    const uploadInputRef = useRef<HTMLInputElement>(null)
    const promptInputRef = useRef<PromptInputRef>(null)
    const composerViewportRef = useRef<HTMLDivElement>(null)

    const [fileContents, setFileContents] = useState<Record<string, string>>({})
    const [localUploadingFiles, setLocalUploadingFiles] = useState<LocalUploadingFile[]>([])
    const [dialogFile, setDialogFile] = useState<{
        content: string
        fileName: string
        fileType: string
    } | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [extendedFiles, setExtendedFiles] = useState<ExtendedUploadedFile[]>([])

    const {
        state: voiceState,
        startRecording,
        stopRecording
    } = useVoiceRecorder({
        onTranscript: (text: string) => {
            if (promptInputRef.current) {
                const currentValue = promptInputRef.current.getValue()
                const newValue = currentValue ? `${currentValue} ${text}` : text
                promptInputRef.current.setValue(newValue)
                localStorage.setItem("user-input", newValue)
                promptInputRef.current.focus()
                setInputValue(newValue)
            }
        }
    })

    useEffect(() => {
        setExtendedFiles(uploadedFiles.map((file) => ({ ...file })))
    }, [uploadedFiles])

    const requiresNativePdfForModelSelection = useMemo(
        () => threadHasPdfAttachments || hasPdfAttachmentInUploadedFiles(uploadedFiles),
        [threadHasPdfAttachments, uploadedFiles]
    )

    const handleSubmit = async () => {
        const inputValue = promptInputRef.current?.getValue() || ""
        const submitAction = resolveMultimodalSubmitAction(status, inputValue)

        if (submitAction === "stop") {
            onSubmit()
            return
        }

        if (submitAction === "focus") {
            promptInputRef.current?.focus()
            return
        }

        if (isImageGenerationPending && !imageGenerationGateBypassRef.current) {
            toast.warning("An image is still generating in this chat.", {
                action: {
                    label: "Send anyway",
                    onClick: () => {
                        imageGenerationGateBypassRef.current = true
                        void handleSubmit()
                    }
                }
            })
            return
        }
        imageGenerationGateBypassRef.current = false

        const attachmentValidationErrors = uploadedFiles
            .map((file) =>
                getAttachmentValidationError(
                    {
                        name: file.fileName,
                        mimeType: file.fileType,
                        size: file.fileSize
                    },
                    {
                        supportsVision: modelSupportsVision,
                        supportsNativePdf: modelSupportsNativePdf
                    },
                    uploadPolicy
                )
            )
            .filter((error): error is string => Boolean(error))

        if (attachmentValidationErrors.length > 0) {
            toast.error(`File validation failed:\n${attachmentValidationErrors.join("\n")}`)
            return
        }

        promptInputRef.current?.clear()
        localStorage.removeItem("user-input")
        setInputValue("")
        onSubmit(inputValue, uploadedFiles)
    }

    const [inputValue, setInputValue] = useState("")
    const isInputEmpty = !inputValue.trim()
    const voiceInputEnabled = optionalBrowserEnv("VITE_ENABLE_VOICE_INPUT") === "true"
    const predictedByokContextRouting = useMemo(() => {
        if (!selectedSharedModel || isImageModel) return null
        if (!selectedSharedModel.adapters.some((adapter) => adapter.startsWith("openrouter:"))) {
            return null
        }
        const openRouterByokEnabled = userSettings.coreAIProviders?.openrouter?.enabled === true
        const { hostedInputLimit, modelInputLimit } =
            resolveComposerContextLimits(selectedSharedModel)
        const attachmentTokens = uploadedFiles.reduce((total, file) => {
            const hasCachedContent = Object.hasOwn(fileContents, file.key)
            return (
                total + estimateUploadedFileTokens(file, fileContents[file.key], hasCachedContent)
            )
        }, 0)
        const draftTokens =
            DEFAULT_MESSAGE_OVERHEAD_TOKENS + estimateTokenCount(inputValue) + attachmentTokens
        const threadTokens = messages.reduce(
            (total, message) => total + estimateUiMessageTokens(message),
            0
        )
        const prospectiveTokens = threadTokens + draftTokens
        const composerWarningThreshold =
            hostedInputLimit * COMPOSER_CONTEXT_WARNING_CONFIDENCE_MULTIPLIER

        if (draftTokens > composerWarningThreshold) {
            return {
                reason: "message" as const,
                estimatedTokens: draftTokens,
                limitTokens: hostedInputLimit,
                openRouterByokEnabled,
                exceedsModelLimit: draftTokens > modelInputLimit
            }
        }

        if (prospectiveTokens > composerWarningThreshold) {
            return {
                reason: "thread" as const,
                estimatedTokens: prospectiveTokens,
                limitTokens: hostedInputLimit,
                openRouterByokEnabled,
                exceedsModelLimit: prospectiveTokens > modelInputLimit
            }
        }

        return null
    }, [
        fileContents,
        inputValue,
        isImageModel,
        messages,
        selectedSharedModel,
        uploadedFiles,
        userSettings
    ])

    useEffect(() => {
        const checkInputValue = () => {
            const value = promptInputRef.current?.getValue() || ""
            setInputValue(value)
        }

        const initialValue = localStorage.getItem("user-input") || ""
        setInputValue(initialValue)

        const interval = setInterval(checkInputValue, 200)
        return () => clearInterval(interval)
    }, [])

    const handleVoiceButtonClick = () => {
        if (voiceState.isRecording) {
            stopRecording()
        } else if (!voiceInputEnabled) {
            handleSubmit()
        } else if (isInputEmpty && !isLoading) {
            startRecording()
        } else {
            handleSubmit()
        }
    }

    const uploadFileWithProgress = useCallback(
        async (
            file: File,
            onProgress: (progress: number) => void
        ): Promise<ExtendedUploadedFile> => {
            const jwt = await resolveJwtToken(token)
            if (!jwt) {
                throw new Error("Authentication token unavailable")
            }

            return uploadChatAttachment({
                file,
                jwt,
                uploadUrl: `${browserEnv("VITE_CONVEX_API_URL")}/upload`,
                policyVersion,
                onPolicyVersionMismatch: invalidateUploadPolicy,
                onProgress
            })
        },
        [invalidateUploadPolicy, policyVersion, token]
    )

    const handleFileUpload = useCallback(
        async (filesToUpload: File[]) => {
            if (filesToUpload.length === 0) return

            const syncErrors: string[] = []
            const validFiles: File[] = []

            for (const file of filesToUpload) {
                const validationError = getAttachmentValidationError(
                    {
                        name: file.name,
                        mimeType: file.type,
                        size: file.size
                    },
                    {
                        supportsVision: modelSupportsVision,
                        supportsNativePdf: modelSupportsNativePdf
                    },
                    uploadPolicy
                )

                if (validationError) {
                    syncErrors.push(validationError)
                    continue
                }

                validFiles.push(file)
            }

            if (syncErrors.length > 0) {
                toast.error(`File validation failed:\n${syncErrors.join("\n")}`)
            }

            if (validFiles.length === 0) return

            const newLocalFiles = validFiles.map((file) => {
                const id = Math.random().toString(36).substring(7)
                let previewUrl: string | undefined

                if (
                    isImageMimeType(file.type) &&
                    !isSvgMimeType(file.type) &&
                    !isSvgExtension(file.name)
                ) {
                    previewUrl = URL.createObjectURL(file)
                }

                return {
                    id,
                    file,
                    progress: 0,
                    status: "uploading" as const,
                    previewUrl
                }
            })

            setLocalUploadingFiles((prev) => [...prev, ...newLocalFiles])
            setUploading(true)

            newLocalFiles.forEach(async (localFile) => {
                try {
                    const fileToUpload = await prepareChatAttachmentForUpload(
                        localFile.file,
                        uploadPolicy
                    )

                    const result = await uploadFileWithProgress(fileToUpload, (progress) => {
                        setLocalUploadingFiles((prev) =>
                            prev.map((f) => (f.id === localFile.id ? { ...f, progress } : f))
                        )
                    })

                    setLocalUploadingFiles((prev) =>
                        prev.map((f) => (f.id === localFile.id ? { ...f, progress: 100 } : f))
                    )

                    if (result.file) {
                        const content = await readChatAttachmentContent(result.file)
                        setFileContents((prev) => ({
                            ...prev,
                            [result.key]: content
                        }))
                    }

                    await new Promise((resolve) => setTimeout(resolve, 500))

                    setLocalUploadingFiles((prev) =>
                        prev.map((f) => (f.id === localFile.id ? { ...f, status: "success" } : f))
                    )

                    await new Promise((resolve) => setTimeout(resolve, 500))

                    addUploadedFile(result)

                    if (localFile.previewUrl) {
                        URL.revokeObjectURL(localFile.previewUrl)
                    }

                    setLocalUploadingFiles((prev) => {
                        const next = prev.filter((f) => f.id !== localFile.id)
                        if (next.length === 0) {
                            setUploading(false)
                        }
                        return next
                    })
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Upload failed"
                    toast.error(errorMessage)

                    setLocalUploadingFiles((prev) =>
                        prev.map((f) =>
                            f.id === localFile.id
                                ? { ...f, status: "error", error: errorMessage }
                                : f
                        )
                    )

                    setTimeout(() => {
                        if (localFile.previewUrl) {
                            URL.revokeObjectURL(localFile.previewUrl)
                        }
                        setLocalUploadingFiles((prev) => {
                            const next = prev.filter((f) => f.id !== localFile.id)
                            if (next.length === 0) {
                                setUploading(false)
                            }
                            return next
                        })
                    }, 2000)
                }
            })

            if (uploadInputRef.current) {
                uploadInputRef.current.value = ""
            }
        },
        [
            uploadFileWithProgress,
            addUploadedFile,
            setUploading,
            modelSupportsVision,
            modelSupportsNativePdf,
            uploadPolicy
        ]
    )

    useImperativeHandle(
        ref,
        () => ({
            handleFileUpload,
            setValue: (value: string) => {
                promptInputRef.current?.setValue(value)
                localStorage.setItem("user-input", value)
                setInputValue(value)
            },
            insertQuote: (selection: string) => {
                const currentValue = promptInputRef.current?.getValue() || ""
                const nextValue = appendQuotedSelection(currentValue, selection)

                if (nextValue === currentValue) {
                    return
                }

                promptInputRef.current?.setValue(nextValue)
                promptInputRef.current?.focus()
                localStorage.setItem("user-input", nextValue)
                setInputValue(nextValue)
            }
        }),
        [handleFileUpload]
    )

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const newFiles = Array.from(event.target.files)
            handleFileUpload(newFiles)
        }
    }

    const handleRemoveFile = (key: string) => {
        removeUploadedFile(key)
        setFileContents((prev) => {
            const newContents = { ...prev }
            delete newContents[key]
            return newContents
        })
        deleteFileMutation({ key })
            .then((result) => {
                if (!result.success) {
                    toast.error(result.error || "Failed to delete attachment")
                }
            })
            .catch((error) => {
                toast.error(error instanceof Error ? error.message : "Failed to delete attachment")
            })
    }

    const handlePaste = useCallback(
        async (e: ClipboardEvent) => {
            const items = Array.from(e.clipboardData?.items || [])
            const files: File[] = []
            let hasText = false

            for (const item of items) {
                if (item.kind === "file") {
                    const file = item.getAsFile()
                    if (file) {
                        files.push(file)
                        e.preventDefault()
                    }
                } else if (item.kind === "string" && item.type === "text/plain") {
                    hasText = true
                }
            }

            if (files.length > 0) {
                await handleFileUpload(files)
            }

            if (!hasText && files.length === 0) {
                e.preventDefault()
            }
        },
        [handleFileUpload]
    )

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return "0 Bytes"
        const k = 1024
        const sizes = ["Bytes", "KB", "MB", "GB"]
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
    }

    const getFileType = (
        uploadedFile: ExtendedUploadedFile
    ): { isImage: boolean; isCode: boolean; isText: boolean } => {
        const fileType = uploadedFile.file?.type || uploadedFile.fileType
        return getFileTypeInfo(uploadedFile.fileName, fileType)
    }

    const getFileIcon = (uploadedFile: ExtendedUploadedFile) => {
        const { isImage, isCode } = getFileType(uploadedFile)

        if (isImage) return <ImageIcon className="size-4 text-blue-500" />
        if (isCode) return <Code className="size-4 text-green-500" />
        return <FileType className="size-4 text-gray-500" />
    }

    const renderLocalUploadingFile = (localFile: LocalUploadingFile) => {
        const { isImage, isCode } = getFileTypeInfo(localFile.file.name, localFile.file.type)

        return (
            <div key={localFile.id} className="group relative">
                <div
                    className={cn(
                        "relative flex h-12 max-w-[12.5rem] items-center justify-center overflow-hidden border-2 border-border bg-secondary/50 transition-colors",
                        isImage ? "w-12" : "w-auto min-w-[5rem]"
                    )}
                    style={{ borderRadius: "var(--radius)" }}
                >
                    {isImage && localFile.previewUrl ? (
                        <>
                            <img
                                src={localFile.previewUrl}
                                alt=""
                                className={cn(
                                    "h-full w-full object-cover transition-all",
                                    localFile.status === "uploading" && "opacity-40 blur-[2px]"
                                )}
                                style={{ borderRadius: "calc(var(--radius) - 2px)" }}
                            />
                            {localFile.status === "uploading" && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/20">
                                    <span className="font-semibold text-[0.625rem] text-white drop-shadow-md">
                                        {localFile.progress}%
                                    </span>
                                    <div
                                        className="h-1 w-8 overflow-hidden bg-white/30"
                                        style={{ borderRadius: "var(--radius)" }}
                                    >
                                        <div
                                            className="h-full bg-white transition-all duration-200"
                                            style={{ width: `${localFile.progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                            {localFile.status === "success" && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/90 text-primary-foreground">
                                        <Check className="size-3" />
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex w-full items-center justify-start gap-2 px-2 font-medium text-sm">
                            <div className="shrink-0">
                                {isCode ? (
                                    <Code className="size-4 text-green-500" />
                                ) : (
                                    <FileType className="size-4 text-gray-500" />
                                )}
                            </div>
                            <div className="flex min-w-0 flex-col items-start overflow-hidden">
                                <span className="w-full truncate text-ellipsis text-left">
                                    {localFile.file.name}
                                </span>
                                {localFile.status === "uploading" ? (
                                    <div className="mt-1 flex w-full items-center gap-2">
                                        <div
                                            className="h-1 flex-1 overflow-hidden bg-border"
                                            style={{ borderRadius: "var(--radius)" }}
                                        >
                                            <div
                                                className="h-full bg-primary transition-all duration-200"
                                                style={{
                                                    width: `${localFile.progress}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                ) : localFile.status === "success" ? (
                                    <div className="mt-0.5 flex items-center gap-1 text-primary text-xs">
                                        <Check className="size-3" />
                                        <span>Uploaded</span>
                                    </div>
                                ) : (
                                    <span className="w-full truncate text-left text-destructive text-xs">
                                        Error
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const renderFilePreview = (uploadedFile: ExtendedUploadedFile) => {
        const content = fileContents[uploadedFile.key]
        const { isImage } = getFileType(uploadedFile)

        return (
            <div key={uploadedFile.key} className="group relative">
                <button
                    type="button"
                    onClick={() => {
                        setDialogFile({
                            content,
                            fileName: uploadedFile.fileName,
                            fileType: uploadedFile.fileType
                        })
                        setDialogOpen(true)
                    }}
                    className={cn(
                        "relative flex h-12 max-w-[12.5rem] items-center justify-center overflow-hidden border-2 border-border bg-secondary/50 transition-colors hover:bg-secondary/80",
                        isImage ? "w-12" : "w-auto"
                    )}
                    style={{ borderRadius: "var(--radius)" }}
                >
                    {content && isImage ? (
                        <img
                            src={content}
                            alt=""
                            className="h-full w-full object-cover"
                            style={{ borderRadius: "calc(var(--radius) - 2px)" }}
                        />
                    ) : (
                        <div className="flex w-full items-center justify-start gap-2 px-2 font-medium text-sm">
                            <div className="shrink-0">{getFileIcon(uploadedFile)}</div>
                            <div className="flex min-w-0 flex-col items-start overflow-hidden">
                                <span className="w-full truncate text-ellipsis text-left">
                                    {uploadedFile.fileName}
                                </span>
                                <span className="truncate text-ellipsis text-muted-foreground text-xs">
                                    {formatFileSize(uploadedFile.fileSize)}
                                </span>
                            </div>
                        </div>
                    )}
                </button>

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveFile(uploadedFile.key)
                    }}
                    className="-top-2 -right-2 absolute h-5 w-5 rounded-full bg-destructive p-0 text-destructive-foreground opacity-0 transition-opacity hover:bg-destructive/80 group-hover:opacity-100"
                >
                    <X className="size-3" />
                </Button>
            </div>
        )
    }

    const renderDialogContent = () => {
        if (!dialogFile) return null

        const fileTypeInfo = getFileTypeInfo(dialogFile.fileName, dialogFile.fileType)
        const isImage = fileTypeInfo.isImage
        const isText = fileTypeInfo.isText

        return (
            <div className="max-h-[70dvh] w-full overflow-auto">
                {isImage ? (
                    <img
                        src={dialogFile.content}
                        alt={dialogFile.fileName}
                        className="h-auto w-full rounded object-contain"
                    />
                ) : isText ? (
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-muted p-4 text-sm">
                        {dialogFile.content}
                    </pre>
                ) : (
                    <div className="flex items-center justify-center p-8 text-muted-foreground">
                        <div className="text-center">
                            <FileType className="mx-auto mb-2 size-12" />
                            <p>Binary file: {dialogFile.fileName}</p>
                            <p className="mt-1 text-xs">Preview not available</p>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    const [isClient, setIsClient] = useState(false)
    const isNewChatComposer = !threadId && messages.length === 0

    useEffect(() => {
        setIsClient(true)
    }, [])

    useEffect(() => {
        if (!isActive) {
            return
        }

        const handleGlobalPaste = (e: ClipboardEvent) => {
            if (
                document.activeElement?.tagName === "TEXTAREA" ||
                document.activeElement?.tagName === "INPUT"
            ) {
                handlePaste(e)
            }
        }

        document.addEventListener("paste", handleGlobalPaste)
        return () => document.removeEventListener("paste", handleGlobalPaste)
    }, [handlePaste, isActive])

    if (!isClient) return null

    return (
        <>
            {voiceInputEnabled && (voiceState.isRecording || voiceState.isTranscribing) && (
                <div className="@container w-full md:px-2">
                    <VoiceRecorder
                        state={voiceState}
                        onStop={stopRecording}
                        className={cn(
                            "mx-auto w-full",
                            getChatWidthClass(chatWidthState.chatWidth)
                        )}
                    />
                </div>
            )}

            <div
                ref={composerViewportRef}
                className={cn(
                    "@container w-full px-1",
                    (voiceState.isRecording || voiceState.isTranscribing) && "hidden"
                )}
            >
                <PromptInput
                    ref={promptInputRef}
                    onSubmit={handleSubmit}
                    disableKeyboardSubmit={isMobile}
                    invertSendNewlineBehavior={invertSendNewlineBehavior}
                    maxHeight={240}
                    className={cn(
                        "mx-auto w-full",
                        isNewChatComposer && "rounded-[var(--radius-lg)]",
                        getChatWidthClass(chatWidthState.chatWidth)
                    )}
                >
                    {(extendedFiles.length > 0 || localUploadingFiles.length > 0) && (
                        <div className="flex flex-wrap gap-2 pb-3">
                            {extendedFiles.map(renderFilePreview)}
                            {localUploadingFiles.map(renderLocalUploadingFile)}
                        </div>
                    )}
                    <PromptInputTextarea
                        placeholder={
                            isImageModel
                                ? "Describe the image you want to generate..."
                                : "Ask me anything..."
                        }
                    />

                    <PromptInputActions className="flex items-center gap-2 pt-2">
                        <motion.div
                            layout
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden sm:gap-2 sm:overflow-visible"
                        >
                            {selectedModel && (
                                <motion.div
                                    layout
                                    transition={{
                                        duration: 0.2,
                                        ease: [0.16, 1, 0.3, 1]
                                    }}
                                    className="shrink-0"
                                >
                                    <ModelSelector
                                        selectedModel={selectedModel}
                                        onModelChange={setSelectedModel}
                                        shortcutTarget="composer"
                                        requiresNativePdf={requiresNativePdfForModelSelection}
                                        byokContextHint={resolveByokContextHint(
                                            predictedByokContextRouting
                                        )}
                                    />
                                </motion.div>
                            )}
                            <PersonaSelector threadId={threadId} />

                            <input
                                type="file"
                                multiple
                                onChange={handleFileChange}
                                className="hidden"
                                ref={uploadInputRef}
                                accept={getFileAcceptAttribute(modelSupportsVision)}
                            />
                            <ComposerDesktopActions
                                state={composerToolbar}
                                threadId={threadId}
                                uploading={uploading}
                                onAttachClick={() => uploadInputRef.current?.click()}
                            />
                        </motion.div>

                        <ComposerMobileMenu
                            state={composerToolbar}
                            onAttachClick={() => uploadInputRef.current?.click()}
                        />

                        <PromptInputAction
                            tooltip={
                                isImageGenerationPending && !isLoading
                                    ? "Wait for image generation to finish"
                                    : voiceInputEnabled && isInputEmpty && !isLoading
                                      ? "Voice input"
                                      : isLoading
                                        ? "Stop generation"
                                        : "Send message"
                            }
                        >
                            <Button
                                variant="default"
                                size="icon"
                                className="size-8 shrink-0"
                                style={{ borderRadius: "var(--radius-md)" }}
                                disabled={status === "submitted" || uploading}
                                onClick={handleVoiceButtonClick}
                                type="submit"
                            >
                                {isLoading ? (
                                    <Square className="size-5 fill-current" />
                                ) : status === "submitted" ? (
                                    <Loader2 className="size-5 animate-spin" />
                                ) : voiceInputEnabled && isInputEmpty ? (
                                    <Mic className="size-5" />
                                ) : (
                                    <ArrowUp className="size-5" />
                                )}
                            </Button>
                        </PromptInputAction>
                    </PromptInputActions>
                </PromptInput>
            </div>

            <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open)
                    if (!open) {
                        setTimeout(() => setDialogFile(null), 150)
                    }
                }}
            >
                <DialogContent className="md:!max-w-[min(90vw,60rem)] max-h-[90dvh] max-w-full">
                    {dialogFile && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    {getFileIcon({
                                        fileName: dialogFile.fileName,
                                        fileType: dialogFile.fileType
                                    } as ExtendedUploadedFile)}
                                    {dialogFile.fileName}
                                </DialogTitle>
                            </DialogHeader>
                            {renderDialogContent()}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
})
