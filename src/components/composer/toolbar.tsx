import { useCurrentUserSettings } from "@/hooks/use-current-user-settings"
import { useCreditAccess } from "@/components/credits/credit-access-runtime"
import { PromptInputAction } from "@/components/prompt-kit/prompt-input"
import { ToolSelectorPopover } from "@/components/tool-selector-popover"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api } from "@/convex/_generated/api"
import type { SharedModel } from "@/convex/lib/models"
import { useSession } from "@/hooks/auth-hooks"
import { useIsTouchDevice } from "@/hooks/use-touch-device"
import { filterComposerTools } from "@/lib/composer-tool-selection"
import { useDiskCachedQuery } from "@/lib/convex-cached-query"
import { DefaultSettings } from "@/lib/default-user-settings"
import {
    IMAGE_RESOLUTION_OPTIONS,
    type ImageDefaultResolution,
    MAX_DEFAULT_VARIANTS
} from "@/lib/image-generation-defaults"
import type { ReasoningEffort } from "@/lib/model-store"
import { useComposerModelStore as useModelStore } from "@/components/composer/model-context"
import {
    getAllowedReasoningEffortsForModel,
    getReasoningEffortForPlan,
    getReasoningSourceModel,
    getReasoningEffortIcon,
    getReasoningEffortLabelForModel,
    getRequiredPlanToPickModel,
    isInstantReasoningEffortForModel,
    resolveSelectedDisplayModel
} from "@/lib/models-providers-shared"
import { useSharedModels } from "@/lib/shared-models"
import { captureBrowserEvent } from "@/lib/telemetry/browser"
import { TELEMETRY_EVENTS } from "@/lib/telemetry/events"
import type { AbilityId } from "@/lib/tool-abilities"
import {
    DEFAULT_TOOL_CALL_LIMIT_PER_TURN,
    MAX_TOOL_CALL_LIMIT_PER_TURN,
    MIN_TOOL_CALL_LIMIT_PER_TURN,
    clampToolCallLimitPerTurn
} from "@/lib/tool-call-limit"
import { cn } from "@/lib/utils"
import { useConvexMutation } from "@convex-dev/react-query"
import { useConvexAuth } from "convex/react"
import {
    BrainCircuit,
    Check,
    ChevronDown,
    ChevronUp,
    Globe,
    Image as ImageIcon,
    Loader2,
    Minus,
    MoreHorizontal,
    Paperclip,
    Plus,
    Sigma,
    Sparkles,
    SquareTerminal,
    X
} from "lucide-react"
import { motion } from "motion/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

export type ComposerOverlay = "model" | "persona" | "tools" | "reasoning" | "mobile-menu"
const COMPOSER_ACTION_TOOLTIP_DELAY_MS = 1_000
export const ReasoningEffortSelector = ({
    selectedModel,
    tone = "default",
    creditPlan,
    open,
    onOpenChange,
    suppressTooltip = false,
    reasoningModel
}: {
    selectedModel: string | null
    // Custom models aren't in the shared list, so the composer passes them in.
    reasoningModel?: SharedModel
    tone?: "default" | "on-primary"
    creditPlan?: CreditPlan | null
    open?: boolean
    onOpenChange?: (open: boolean) => void
    suppressTooltip?: boolean
}) => {
    const { reasoningEffort, setReasoningEffort, normalizeReasoningEffort } = useModelStore()
    const reconcileReasoning = normalizeReasoningEffort ?? setReasoningEffort
    const { models: sharedModels } = useSharedModels()
    const sharedCreditPlan = useCreditAccess((state) => state.plan)
    const resolvedCreditPlan = creditPlan === undefined ? sharedCreditPlan : creditPlan

    const selectedSharedModel = useMemo(
        () => reasoningModel ?? sharedModels.find((model) => model.id === selectedModel),
        [reasoningModel, selectedModel, sharedModels]
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
            reconcileReasoning(resolvedEffort)
        }
    }, [
        modelSupportsReasoningControl,
        reasoningEffort,
        resolvedCreditPlan,
        selectedSharedModel,
        reconcileReasoning
    ])
    const isReasoningOff = isInstantReasoningEffortForModel(selectedSharedModel, reasoningEffort)
    const reasoningLabel = getReasoningEffortLabelForModel(selectedSharedModel, reasoningEffort)
    const ReasoningIcon = getReasoningEffortIcon(reasoningEffort, selectedSharedModel)

    if (!modelSupportsReasoningControl) return null

    return (
        <PromptInputAction
            tooltip="Select reasoning effort"
            side="right"
            delayDuration={COMPOSER_ACTION_TOOLTIP_DELAY_MS}
            open={suppressTooltip ? false : undefined}
        >
            <span className="inline-flex">
                <Select
                    open={open}
                    onOpenChange={onOpenChange}
                    value={reasoningEffort}
                    onValueChange={(effort) => {
                        const selectedEffort = effort as ReasoningEffort
                        if (selectedEffort !== reasoningEffort) {
                            captureBrowserEvent(TELEMETRY_EVENTS.reasoningEffortManuallySelected, {
                                model_id: selectedModel,
                                previous_effort: reasoningEffort,
                                selected_effort: selectedEffort,
                                surface: "composer_desktop"
                            })
                        }
                        setReasoningEffort(selectedEffort)
                    }}
                >
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
                            <span>{reasoningLabel}</span>
                        </div>
                        <span className="flex items-center gap-1 sm:hidden">
                            <ReasoningIcon className="size-4" />
                        </span>
                    </SelectTrigger>
                    <SelectContent>
                        {allowedEfforts.map((effort) => {
                            const EffortIcon = getReasoningEffortIcon(effort, selectedSharedModel)
                            const isEffortLocked =
                                resolvedCreditPlan === "free" &&
                                selectedSharedModel !== undefined &&
                                getRequiredPlanToPickModel(selectedSharedModel, effort) === "pro"
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
                                    </span>
                                </SelectItem>
                            )
                        })}
                    </SelectContent>
                </Select>
            </span>
        </PromptInputAction>
    )
}

const mobileMenuRowClassName =
    "flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/60"

type CreditPlan = "free" | "pro"

function MobileAvailabilityIndicator({
    label,
    description
}: {
    label: string
    description: string
}) {
    const isTouchDevice = useIsTouchDevice()
    const indicator = (
        <button
            type="button"
            aria-label={`Explain ${label} availability`}
            className="flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-xl)] border border-border bg-muted text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <X className="size-2.5" />
        </button>
    )

    if (!isTouchDevice) {
        return (
            <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>{indicator}</TooltipTrigger>
                <TooltipContent side="left" sideOffset={6}>
                    {description}
                </TooltipContent>
            </Tooltip>
        )
    }

    return (
        <Popover>
            <PopoverTrigger asChild>{indicator}</PopoverTrigger>
            <PopoverContent
                align="center"
                side="left"
                sideOffset={6}
                className="z-[60] w-56 p-2.5 text-muted-foreground text-xs"
                style={{ borderRadius: "var(--radius-md)" }}
            >
                {description}
            </PopoverContent>
        </Popover>
    )
}

function MobileToolRow({
    label,
    icon,
    enabled,
    available,
    onClick
}: {
    label: string
    icon: React.ReactNode
    enabled: boolean
    available: boolean
    onClick: () => void
}) {
    const content = (
        <>
            <span
                className={cn(
                    "flex size-4 shrink-0 items-center justify-center",
                    enabled && available ? "text-foreground" : "text-muted-foreground"
                )}
            >
                {icon}
            </span>
            <span className="min-w-0 flex-1 truncate text-foreground">{label}</span>
        </>
    )

    if (!available) {
        return (
            <div className={cn(mobileMenuRowClassName, "cursor-default")}>
                {content}
                <MobileAvailabilityIndicator
                    label={label}
                    description={`${label} is unavailable with the selected model or current configuration.`}
                />
            </div>
        )
    }

    return (
        <div className={mobileMenuRowClassName}>
            {content}
            <Switch
                checked={enabled}
                aria-label={`${label}: ${enabled ? "On" : "Off"}`}
                onCheckedChange={onClick}
            />
        </div>
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
    codeExecutionAvailable,
    mathematicalInstrumentsAvailable,
    memoryAvailable,
    toolCallLimitPerTurn,
    toolLimitInteractive,
    onSetToolCallLimit,
    imageDefaultResolution,
    imageDefaultVariants,
    onSetImageDefaults,
    onToggleTool,
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
    codeExecutionAvailable: boolean
    mathematicalInstrumentsAvailable: boolean
    memoryAvailable: boolean
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
    onAttachClick: () => void
}) {
    const {
        enabledTools,
        autoSelectTools,
        setAutoSelectTools,
        reasoningEffort,
        setReasoningEffort
    } = useModelStore()
    const [reasoningExpanded, setReasoningExpanded] = useState(false)
    const reasoningLabel = getReasoningEffortLabelForModel(selectedSharedModel, reasoningEffort)
    const ReasoningIcon = getReasoningEffortIcon(reasoningEffort, selectedSharedModel)
    const webSearchEnabled = enabledTools.includes("web_search")
    const codeExecutionEnabled = enabledTools.includes("code_execution")
    const mathematicalInstrumentsEnabled = enabledTools.includes("mathematical_instruments")
    const memoryEnabled = enabledTools.includes("supermemory")

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
                                <span className="min-w-0 flex-1 truncate">Reasoning</span>
                                <span className="shrink-0 rounded-[var(--radius-md)] border border-border/60 bg-muted/50 px-1.5 py-1 text-xs">
                                    {reasoningLabel}
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
                                                onClick={() => {
                                                    if (effort !== reasoningEffort) {
                                                        captureBrowserEvent(
                                                            TELEMETRY_EVENTS.reasoningEffortManuallySelected,
                                                            {
                                                                model_id:
                                                                    selectedSharedModel?.id ?? null,
                                                                previous_effort: reasoningEffort,
                                                                selected_effort: effort,
                                                                surface: "composer_mobile"
                                                            }
                                                        )
                                                    }
                                                    setReasoningEffort(effort)
                                                }}
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
                        <MobileToolRow
                            label="Magic"
                            icon={<Sparkles className="size-4" />}
                            enabled={autoSelectTools}
                            available={modelSupportsFunctionCalling}
                            onClick={() => setAutoSelectTools(!autoSelectTools)}
                        />
                    )}

                    {!isImageModel && (
                        <MobileToolRow
                            label="Code execution"
                            icon={<SquareTerminal className="size-4" />}
                            enabled={codeExecutionEnabled}
                            available={modelSupportsFunctionCalling && codeExecutionAvailable}
                            onClick={() => onToggleTool("code_execution")}
                        />
                    )}

                    {!isImageModel && (
                        <MobileToolRow
                            label="Memory"
                            icon={<BrainCircuit className="size-4" />}
                            enabled={memoryEnabled}
                            available={modelSupportsFunctionCalling && memoryAvailable}
                            onClick={() => onToggleTool("supermemory")}
                        />
                    )}

                    {!isImageModel && (
                        <MobileToolRow
                            label="Math Kit"
                            icon={<Sigma className="size-4" />}
                            enabled={mathematicalInstrumentsEnabled}
                            available={
                                modelSupportsFunctionCalling && mathematicalInstrumentsAvailable
                            }
                            onClick={() => onToggleTool("mathematical_instruments")}
                        />
                    )}

                    {!isImageModel && (
                        <div
                            className={cn(
                                mobileMenuRowClassName,
                                (!modelSupportsVision || !modelSupportsFunctionCalling) &&
                                    "cursor-not-allowed"
                            )}
                        >
                            <ImageIcon
                                className={cn(
                                    "size-4 shrink-0",
                                    !(modelSupportsVision && modelSupportsFunctionCalling) &&
                                        "text-muted-foreground"
                                )}
                            />
                            <span className="min-w-0 flex-1 truncate text-foreground">
                                SilkScreen
                            </span>
                            {modelSupportsVision && modelSupportsFunctionCalling ? (
                                <span className="shrink-0 text-muted-foreground text-xs">Auto</span>
                            ) : (
                                <MobileAvailabilityIndicator
                                    label="SilkScreen"
                                    description="SilkScreen requires a model with vision and tool support."
                                />
                            )}
                        </div>
                    )}

                    {!isImageModel && (
                        <MobileToolRow
                            label="Search"
                            icon={<Globe className="size-4" />}
                            enabled={webSearchEnabled}
                            available={modelSupportsFunctionCalling && webSearchAvailable}
                            onClick={() => onToggleTool("web_search")}
                        />
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

export function useComposerToolbarState() {
    const session = useSession()
    const auth = useConvexAuth()
    const { models: sharedModels } = useSharedModels()
    const creditPlan = useCreditAccess((state) => state.plan)
    const {
        selectedModel,
        enabledTools,
        setEnabledTools,
        setConversationTools,
        reasoningEffort,
        setReasoningEffort,
        normalizeReasoningEffort,
        toolCallLimitPerTurn: sessionToolLimit,
        setToolCallLimitPerTurn: setSessionToolLimit
    } = useModelStore()

    const [pendingToolCallLimitPerTurn, setPendingToolCallLimitPerTurn] = useState<number | null>(
        null
    )

    const userSettings = useCurrentUserSettings(session.user?.id, auth.isLoading)
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
    const resolvedUserSettings =
        "error" in userSettings ? DefaultSettings(session.user?.id ?? "CACHE") : userSettings
    const resolvedToolAvailability =
        toolAvailability && !("error" in toolAvailability) ? toolAvailability : null

    const customModels = resolvedUserSettings.customModels
    const selectedDisplayModel = useMemo(
        () => resolveSelectedDisplayModel(selectedModel, sharedModels, customModels),
        [customModels, selectedModel, sharedModels]
    )
    // Custom models stand in with their stored reasoning levels.
    const selectedSharedModel = useMemo(
        () => getReasoningSourceModel(selectedDisplayModel),
        [selectedDisplayModel]
    )
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
        if (selectedDisplayModel && !modelSupportsReasoningControl && reasoningEffort !== "off") {
            ;(normalizeReasoningEffort ?? setReasoningEffort)("off")
        }
    }, [
        modelSupportsReasoningControl,
        reasoningEffort,
        setReasoningEffort,
        normalizeReasoningEffort,
        selectedDisplayModel
    ])

    const webSearchAvailable = Boolean(resolvedToolAvailability?.web_search.enabled)
    const codeExecutionAvailable = Boolean(resolvedToolAvailability?.code_execution?.enabled)
    const mathematicalInstrumentsAvailable = Boolean(
        resolvedToolAvailability?.mathematical_instruments?.enabled
    )
    const hostedMemoryAvailable = Boolean(resolvedToolAvailability?.supermemory.enabled)
    const invertSendNewlineBehavior = resolvedUserSettings.invertSendNewlineBehavior === true

    useEffect(() => {
        const nextEnabledTools = filterComposerTools(
            enabledTools,
            resolvedToolAvailability,
            selectedDisplayModel ? modelSupportsFunctionCalling : undefined
        )
        if (nextEnabledTools.length !== enabledTools.length) {
            for (const tool of enabledTools) {
                if (!nextEnabledTools.includes(tool)) {
                    captureBrowserEvent(TELEMETRY_EVENTS.toolToggled, {
                        tool_id: tool,
                        enabled: false,
                        surface: "automatic",
                        model_id: selectedModel
                    })
                }
            }
            setConversationTools(nextEnabledTools)
        }
    }, [
        resolvedToolAvailability,
        selectedDisplayModel,
        modelSupportsFunctionCalling,
        enabledTools,
        selectedModel,
        setConversationTools
    ])

    const activeToolCount = [
        webSearchAvailable && enabledTools.includes("web_search"),
        codeExecutionAvailable && enabledTools.includes("code_execution"),
        mathematicalInstrumentsAvailable && enabledTools.includes("mathematical_instruments"),
        modelSupportsFunctionCalling &&
            hostedMemoryAvailable &&
            enabledTools.includes("supermemory")
    ].filter(Boolean).length
    const toolLimitInteractive = activeToolCount > 0
    const effectiveToolCallLimitPerTurn = clampToolCallLimitPerTurn(
        sessionToolLimit ?? resolvedUserSettings.toolCallLimitPerTurn,
        { hasEnabledTools: toolLimitInteractive }
    )
    const displayedToolCallLimitPerTurn =
        pendingToolCallLimitPerTurn ?? effectiveToolCallLimitPerTurn

    const handleToolToggle = (tool: AbilityId) => {
        if (tool === "web_search" && (!modelSupportsFunctionCalling || !webSearchAvailable)) return
        if (tool === "code_execution" && (!modelSupportsFunctionCalling || !codeExecutionAvailable))
            return
        if (
            tool === "mathematical_instruments" &&
            (!modelSupportsFunctionCalling || !mathematicalInstrumentsAvailable)
        ) {
            return
        }
        if (tool === "supermemory" && (!modelSupportsFunctionCalling || !hostedMemoryAvailable)) {
            return
        }

        const enabled = !enabledTools.includes(tool)
        captureBrowserEvent(TELEMETRY_EVENTS.toolToggled, {
            tool_id: tool,
            enabled,
            surface: "mobile_overflow",
            model_id: selectedModel
        })
        setEnabledTools(
            enabled
                ? [...enabledTools, tool]
                : enabledTools.filter((enabledTool) => enabledTool !== tool)
        )
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

    const handleToolCallLimitUpdate = useCallback(
        (nextLimit: number) => {
            if (setSessionToolLimit) setSessionToolLimit(nextLimit)
            else setPendingToolCallLimitPerTurn(nextLimit)
        },
        [setSessionToolLimit]
    )

    const imageDefaults = resolvedUserSettings.imageGenerationDefaults
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
        userSettings: resolvedUserSettings,
        selectedSharedModel,
        allowedReasoningEfforts,
        modelSupportsReasoningControl,
        modelSupportsVision,
        modelSupportsFunctionCalling,
        modelSupportsNativePdf,
        isImageModel,
        webSearchAvailable,
        codeExecutionAvailable,
        mathematicalInstrumentsAvailable,
        hostedMemoryAvailable,
        toolLimitInteractive,
        displayedToolCallLimitPerTurn,
        handleToolCallLimitUpdate,
        imageDefaultResolution,
        imageDefaultVariants,
        handleImageDefaultsUpdate,
        handleToolToggle,
        invertSendNewlineBehavior
    }
}

export type ComposerToolbarState = ReturnType<typeof useComposerToolbarState>

export function ComposerDesktopActions({
    state,
    threadId,
    uploading,
    onAttachClick,
    activeOverlay,
    onOverlayOpenChange
}: {
    state: ComposerToolbarState
    threadId?: string
    uploading: boolean
    onAttachClick: () => void
    activeOverlay?: ComposerOverlay | null
    onOverlayOpenChange?: (overlay: ComposerOverlay, open: boolean) => void
}) {
    const { enabledTools, setEnabledTools } = useModelStore()
    const suppressTooltips = activeOverlay !== null

    return (
        <motion.div
            layout
            transition={{
                duration: 0.2,
                ease: [0.16, 1, 0.3, 1]
            }}
            className="@3xl:flex hidden items-center gap-2"
        >
            {state.isImageModel ? null : (
                <>
                    <PromptInputAction
                        tooltip="Attach files"
                        delayDuration={COMPOSER_ACTION_TOOLTIP_DELAY_MS}
                        open={suppressTooltips ? false : undefined}
                    >
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
                                <Paperclip className="size-4 -rotate-45 hover:text-primary" />
                            )}
                        </Button>
                    </PromptInputAction>

                    <PromptInputAction
                        tooltip="Tools"
                        delayDuration={COMPOSER_ACTION_TOOLTIP_DELAY_MS}
                        open={suppressTooltips ? false : undefined}
                    >
                        <span className="inline-flex">
                            <ToolSelectorPopover
                                enabledTools={enabledTools}
                                onEnabledToolsChange={setEnabledTools}
                                modelSupportsFunctionCalling={state.modelSupportsFunctionCalling}
                                modelSupportsVision={state.modelSupportsVision}
                                selectedModel={state.selectedModel}
                                open={onOverlayOpenChange ? activeOverlay === "tools" : undefined}
                                onOpenChange={
                                    onOverlayOpenChange
                                        ? (open) => onOverlayOpenChange("tools", open)
                                        : undefined
                                }
                            />
                        </span>
                    </PromptInputAction>

                    <ReasoningEffortSelector
                        selectedModel={state.selectedModel}
                        reasoningModel={state.selectedSharedModel}
                        creditPlan={state.creditPlan}
                        open={onOverlayOpenChange ? activeOverlay === "reasoning" : undefined}
                        onOpenChange={
                            onOverlayOpenChange
                                ? (open) => onOverlayOpenChange("reasoning", open)
                                : undefined
                        }
                        suppressTooltip={suppressTooltips}
                    />
                </>
            )}
        </motion.div>
    )
}

export function ComposerMobileMenu({
    state,
    onAttachClick,
    open: controlledOpen,
    onOpenChange
}: {
    state: ComposerToolbarState
    onAttachClick: () => void
    open?: boolean
    onOpenChange?: (open: boolean) => void
}) {
    const [internalOpen, setInternalOpen] = useState(false)
    const open = controlledOpen ?? internalOpen
    const enabledTools = useModelStore((modelState) => modelState.enabledTools)

    if (state.isImageModel && !state.modelSupportsReasoningControl) {
        return null
    }

    return (
        <div className="@3xl:hidden shrink-0">
            <MobileOverflowMenu
                open={open}
                onOpenChange={(nextOpen) => {
                    if (controlledOpen === undefined) setInternalOpen(nextOpen)
                    onOpenChange?.(nextOpen)
                    if (nextOpen) {
                        captureBrowserEvent(TELEMETRY_EVENTS.advancedOptionsOpened, {
                            surface: "mobile_overflow",
                            enabled_tool_ids: enabledTools
                        })
                    }
                }}
                selectedModel={state.selectedModel}
                modelSupportsVision={state.modelSupportsVision}
                modelSupportsFunctionCalling={state.modelSupportsFunctionCalling}
                modelSupportsReasoningControl={state.modelSupportsReasoningControl}
                isImageModel={state.isImageModel}
                allowedReasoningEfforts={state.allowedReasoningEfforts}
                selectedSharedModel={state.selectedSharedModel}
                creditPlan={state.creditPlan}
                webSearchAvailable={state.webSearchAvailable}
                codeExecutionAvailable={state.codeExecutionAvailable}
                mathematicalInstrumentsAvailable={state.mathematicalInstrumentsAvailable}
                memoryAvailable={state.hostedMemoryAvailable}
                toolCallLimitPerTurn={state.displayedToolCallLimitPerTurn}
                toolLimitInteractive={state.toolLimitInteractive}
                onSetToolCallLimit={state.handleToolCallLimitUpdate}
                imageDefaultResolution={state.imageDefaultResolution}
                imageDefaultVariants={state.imageDefaultVariants}
                onSetImageDefaults={state.handleImageDefaultsUpdate}
                onToggleTool={state.handleToolToggle}
                onAttachClick={onAttachClick}
            />
        </div>
    )
}
