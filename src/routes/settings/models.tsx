import { OpenRouterIcon } from "@/components/brand-icons"
import { ModelExpiryBadge } from "@/components/model-expiry-badge"
import {
    SettingsFormActions,
    SettingsSectionHeader,
    StatusDot
} from "@/components/settings/settings-section"
import { ModelListSkeleton } from "@/components/settings/settings-skeletons"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import type { ModelAbility, StoredModelAbility } from "@/convex/schema/settings"
import { useSession } from "@/hooks/auth-hooks"
import {
    type CustomModelFormData,
    type DisplayModel,
    getAbilityIcon,
    getAbilityLabel,
    getModelRoutingDisabledReason,
    getProviderDisplayName,
    isCustomModelProviderAvailable,
    isImageGenerationCapableModel,
    isSupportedCustomModelCoreProvider,
    useAvailableModels
} from "@/lib/models-providers-shared"
import type { ReasoningEffort } from "@/lib/model-store"
import { cn } from "@/lib/utils"
import { sortReasoningEfforts } from "@/convex/lib/models/reasoning"
import { useConvexQuery } from "@convex-dev/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { Check, ChevronsUpDown, Image, Pencil, Plus, Trash2 } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/settings/models")({
    component: LegacyModelsRedirect
})

const CUSTOM_MODEL_ABILITIES = [
    "vision",
    "reasoning",
    "function_calling",
    "native_pdf"
] as ModelAbility[]

// Defaults for new custom models; OpenRouter picks replace them with catalog values.
const DEFAULT_CONTEXT_LENGTH = 128_000
const DEFAULT_MAX_TOKENS = 8192

const EMPTY_CUSTOM_MODEL: CustomModelFormData = {
    name: "",
    modelId: "",
    providerId: "",
    contextLength: DEFAULT_CONTEXT_LENGTH,
    maxTokens: DEFAULT_MAX_TOKENS,
    abilities: [],
    enabled: true
}

type OpenRouterCatalogEntry = FunctionReturnType<
    typeof api.model_provider_metadata.listOpenRouterCatalog
>[number]

type CurrentProviders = ReturnType<typeof useAvailableModels>["currentProviders"]

// Stored custom models may still carry the legacy "pdf" ability.
const normalizeAbilities = (abilities: readonly (StoredModelAbility | ModelAbility)[]) => [
    ...new Set(
        abilities
            .map((ability) => (ability === "pdf" ? "native_pdf" : ability))
            .filter((ability) => ability !== "effort_control")
    )
]

const isCustomDisplayModel = (model: DisplayModel) => "isCustom" in model && model.isCustom

function LegacyModelsRedirect() {
    const navigate = useNavigate()

    useEffect(() => {
        navigate({
            to: "/settings/ai-setup",
            search: { tab: "models" },
            replace: true
        })
    }, [navigate])

    return null
}

function ModelRow({
    name,
    badges,
    abilities,
    imageGeneration = false,
    meta,
    actions,
    dimmed = false
}: {
    name: string
    badges?: ReactNode
    abilities: ModelAbility[]
    imageGeneration?: boolean
    meta?: ReactNode
    actions?: ReactNode
    dimmed?: boolean
}) {
    return (
        <Card className={cn("gap-0 px-4 py-3 shadow-xs", dimmed && "bg-muted/20 opacity-60")}>
            <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-sm">{name}</h4>
                        {badges}
                    </div>
                    {(imageGeneration || abilities.length > 0) && (
                        <div className="mt-1 flex flex-wrap gap-0.75">
                            {imageGeneration && (
                                <Badge variant="secondary" className="gap-1.5 px-1.5 text-xs">
                                    <Image className="size-3" />
                                    Image generation
                                </Badge>
                            )}
                            {abilities.map((ability) => {
                                const Icon = getAbilityIcon(ability)
                                return (
                                    <Badge
                                        key={ability}
                                        variant="secondary"
                                        className="gap-1.5 px-1.5 text-xs"
                                    >
                                        <Icon className="size-3" />
                                        {getAbilityLabel(ability)}
                                    </Badge>
                                )
                            })}
                        </div>
                    )}
                </div>
                {(meta || actions) && (
                    <div className="flex shrink-0 items-center gap-1">
                        {meta && <span className="mr-2">{meta}</span>}
                        {actions}
                    </div>
                )}
            </div>
        </Card>
    )
}

function SharedModelRow({
    model,
    meta,
    dimmed = false
}: {
    model: DisplayModel
    meta?: ReactNode
    dimmed?: boolean
}) {
    return (
        <ModelRow
            name={model.name}
            abilities={normalizeAbilities(model.abilities)}
            imageGeneration={isImageGenerationCapableModel(model)}
            meta={meta}
            dimmed={dimmed}
        />
    )
}

const formatTokens = (value: number) =>
    new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value)

// OpenRouter names read "Vendor: Model"; the vendor is already in the model ID.
const cleanCatalogName = (name: string) => name.replace(/^[^:]+:\s*/, "")

function OpenRouterModelPicker({
    id,
    value,
    catalog,
    onSelectEntry
}: {
    id: string
    value: string
    catalog: OpenRouterCatalogEntry[] | undefined
    onSelectEntry: (entry: OpenRouterCatalogEntry) => void
}) {
    const [open, setOpen] = useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    <span className={cn("truncate", value ? "font-mono" : "text-muted-foreground")}>
                        {value || "Search OpenRouter models"}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
                <Command>
                    <CommandInput autoFocus placeholder="Model name or ID" />
                    <CommandList>
                        <CommandEmpty>
                            {catalog === undefined ? "Loading models..." : "No models found"}
                        </CommandEmpty>
                        <CommandGroup>
                            {catalog?.map((entry) => (
                                <CommandItem
                                    key={entry.id}
                                    value={`${entry.name} ${entry.id}`}
                                    onSelect={() => {
                                        onSelectEntry(entry)
                                        setOpen(false)
                                    }}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-sm">{entry.name}</span>
                                            {entry.expirationDate && (
                                                <ModelExpiryBadge
                                                    expirationDate={entry.expirationDate}
                                                    className="shrink-0 px-1.5 text-[0.625rem]"
                                                />
                                            )}
                                        </div>
                                        <div className="truncate font-mono text-muted-foreground text-xs">
                                            {entry.id}
                                        </div>
                                    </div>
                                    {entry.id === value && <Check className="size-4 shrink-0" />}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

const REASONING_LEVEL_LABELS: Record<ReasoningEffort, string> = {
    off: "Off",
    minimal: "Minimal",
    low: "Low",
    medium: "Medium",
    high: "High",
    xhigh: "Extra high",
    max: "Max"
}
const REASONING_LEVELS = Object.keys(REASONING_LEVEL_LABELS) as ReasoningEffort[]

// Levels the composer offers for this model, in a fixed order. OpenRouter's values are
// prefilled; "Off" lets reasoning be turned off.
function ReasoningLevelsEditor({
    idPrefix,
    levels,
    defaultLevel,
    onChange
}: {
    idPrefix: string
    levels: ReasoningEffort[]
    defaultLevel?: ReasoningEffort
    onChange: (levels: ReasoningEffort[], defaultLevel?: ReasoningEffort) => void
}) {
    const hasEffortLevels = levels.some((level) => level !== "off")

    const toggleLevel = (level: ReasoningEffort) => {
        const next = sortReasoningEfforts(
            levels.includes(level) ? levels.filter((item) => item !== level) : [...levels, level]
        )
        onChange(next, defaultLevel && next.includes(defaultLevel) ? defaultLevel : undefined)
    }

    return (
        <div className="space-y-2">
            <Label id={`${idPrefix}-reasoning-levels`}>Reasoning levels</Label>
            <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-labelledby={`${idPrefix}-reasoning-levels`}
            >
                {REASONING_LEVELS.map((level) => {
                    const isSelected = levels.includes(level)
                    return (
                        <Button
                            key={level}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            aria-pressed={isSelected}
                            onClick={() => toggleLevel(level)}
                        >
                            {REASONING_LEVEL_LABELS[level]}
                        </Button>
                    )
                })}
            </div>

            {hasEffortLevels ? (
                <div className="flex items-center gap-3">
                    <Label htmlFor={`${idPrefix}-default-level`} className="shrink-0">
                        Default
                    </Label>
                    <Select
                        value={defaultLevel ?? ""}
                        onValueChange={(value) => onChange(levels, value as ReasoningEffort)}
                    >
                        <SelectTrigger id={`${idPrefix}-default-level`} className="w-40">
                            <SelectValue placeholder="Lowest" />
                        </SelectTrigger>
                        <SelectContent>
                            {levels.map((level) => (
                                <SelectItem key={level} value={level}>
                                    {REASONING_LEVEL_LABELS[level]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            ) : (
                <p className="text-muted-foreground text-xs">
                    {levels.includes("off")
                        ? "Reasoning can be turned on or off."
                        : "Always reasons, with no level picker."}
                </p>
            )}
        </div>
    )
}

function CustomModelForm({
    idPrefix,
    initial,
    providerOptions,
    currentProviders,
    saveLabel,
    savingLabel,
    onSave,
    onCancel
}: {
    idPrefix: string
    initial: CustomModelFormData
    providerOptions: string[]
    currentProviders: CurrentProviders
    saveLabel?: string
    savingLabel?: string
    onSave: (data: CustomModelFormData) => Promise<void>
    onCancel: () => void
}) {
    const [form, setForm] = useState(() => ({
        ...initial,
        // A new model with only one provider to choose from starts on it.
        providerId: initial.providerId || (providerOptions.length === 1 ? providerOptions[0] : "")
    }))
    // Kept as text so the fields can be cleared while typing.
    const [contextLength, setContextLength] = useState(String(initial.contextLength))
    const [maxTokens, setMaxTokens] = useState(String(initial.maxTokens))
    const [showDetails, setShowDetails] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    // The last name filled from the catalog, so picking again replaces it but not a
    // name the user typed.
    const prefilledNameRef = useRef("")
    const prefilledDescriptionRef = useRef("")

    const isOpenRouter = form.providerId === "openrouter"
    const catalog = useQuery(
        api.model_provider_metadata.listOpenRouterCatalog,
        isOpenRouter ? {} : "skip"
    )

    // An edited model keeps its provider as an option even if it's now off or removed.
    const options =
        form.providerId && !providerOptions.includes(form.providerId)
            ? [...providerOptions, form.providerId]
            : providerOptions
    const canSave = Boolean(form.name.trim() && form.modelId.trim() && form.providerId)
    const showOpenRouterHint = !providerOptions.includes("openrouter")
    const showNumberFields = !isOpenRouter || showDetails

    const toPositiveInt = (value: string, fallback: number) => {
        const parsed = Number.parseInt(value, 10)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
    }

    const applyCatalogEntry = (entry: OpenRouterCatalogEntry) => {
        const name = cleanCatalogName(entry.name)
        setForm((prev) => ({
            ...prev,
            modelId: entry.id,
            name: !prev.name.trim() || prev.name === prefilledNameRef.current ? name : prev.name,
            description:
                !prev.description?.trim() || prev.description === prefilledDescriptionRef.current
                    ? (entry.description ?? "")
                    : prev.description,
            abilities: [
                ...(entry.supportsImages ? (["vision"] as const) : []),
                ...(entry.supportsReasoning ? (["reasoning"] as const) : []),
                ...(entry.supportsTools ? (["function_calling"] as const) : []),
                ...(entry.supportsFiles ? (["native_pdf"] as const) : [])
            ],
            reasoningEfforts: entry.reasoningEfforts,
            defaultReasoningEffort: entry.defaultReasoningEffort
        }))
        prefilledNameRef.current = name
        prefilledDescriptionRef.current = entry.description ?? ""
        const context = entry.contextLength ?? DEFAULT_CONTEXT_LENGTH
        setContextLength(String(context))
        setMaxTokens(String(entry.maxCompletionTokens ?? Math.min(DEFAULT_MAX_TOKENS, context)))
    }

    const handleSave = async () => {
        // Levels only apply to OpenRouter models with reasoning; drop them otherwise.
        const keepsReasoningLevels =
            isOpenRouter && form.abilities.includes("reasoning") && form.reasoningEfforts
        setIsSaving(true)
        try {
            await onSave({
                ...form,
                reasoningEfforts: keepsReasoningLevels ? form.reasoningEfforts : undefined,
                defaultReasoningEffort: keepsReasoningLevels
                    ? form.defaultReasoningEffort
                    : undefined,
                name: form.name.trim(),
                modelId: form.modelId.trim(),
                description: form.description?.trim() || undefined,
                contextLength: toPositiveInt(contextLength, DEFAULT_CONTEXT_LENGTH),
                maxTokens: toPositiveInt(maxTokens, DEFAULT_MAX_TOKENS)
            })
        } catch {
            // The parent reports the error; keep the form open.
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Switch
                    id={`${idPrefix}-enabled`}
                    checked={form.enabled}
                    onCheckedChange={(enabled) => setForm((prev) => ({ ...prev, enabled }))}
                />
                <Label htmlFor={`${idPrefix}-enabled`}>Show in model picker</Label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-provider`}>Provider</Label>
                    <Select
                        value={form.providerId}
                        onValueChange={(providerId) => setForm((prev) => ({ ...prev, providerId }))}
                    >
                        <SelectTrigger id={`${idPrefix}-provider`} className="w-full">
                            <SelectValue placeholder="Select a provider" />
                        </SelectTrigger>
                        <SelectContent>
                            {options.map((providerId) => (
                                <SelectItem key={providerId} value={providerId}>
                                    {getProviderDisplayName(providerId, currentProviders)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-model-id`}>Model</Label>
                    {isOpenRouter ? (
                        <OpenRouterModelPicker
                            id={`${idPrefix}-model-id`}
                            value={form.modelId}
                            catalog={catalog}
                            onSelectEntry={applyCatalogEntry}
                        />
                    ) : (
                        <Input
                            id={`${idPrefix}-model-id`}
                            value={form.modelId}
                            onChange={(event) =>
                                setForm((prev) => ({ ...prev, modelId: event.target.value }))
                            }
                            placeholder="model-name"
                            className="font-mono"
                        />
                    )}
                </div>
            </div>

            {showOpenRouterHint && (
                <p className="text-muted-foreground text-xs">
                    To add OpenRouter models,{" "}
                    <Link
                        to="/settings/ai-setup"
                        search={{ tab: "providers" }}
                        className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                    >
                        set up BYOK
                    </Link>
                    .
                </p>
            )}

            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-name`}>Name</Label>
                <Input
                    id={`${idPrefix}-name`}
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="My model"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-description`}>Description</Label>
                <Textarea
                    id={`${idPrefix}-description`}
                    value={form.description ?? ""}
                    onChange={(event) =>
                        setForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="What this model is good at"
                    maxLength={300}
                    className="max-h-40"
                />
            </div>

            {isOpenRouter && form.modelId && !showDetails && (
                <div className="flex items-center justify-between gap-3 text-muted-foreground text-sm">
                    <span>
                        {formatTokens(toPositiveInt(contextLength, DEFAULT_CONTEXT_LENGTH))} context
                        {" · "}
                        {formatTokens(toPositiveInt(maxTokens, DEFAULT_MAX_TOKENS))} max output
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setShowDetails(true)}>
                        Edit details
                    </Button>
                </div>
            )}

            {showNumberFields && (
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor={`${idPrefix}-context`}>Context length</Label>
                        <Input
                            id={`${idPrefix}-context`}
                            type="number"
                            min={1}
                            value={contextLength}
                            onChange={(event) => setContextLength(event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`${idPrefix}-max-tokens`}>Max output tokens</Label>
                        <Input
                            id={`${idPrefix}-max-tokens`}
                            type="number"
                            min={1}
                            value={maxTokens}
                            onChange={(event) => setMaxTokens(event.target.value)}
                        />
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <Label>Abilities</Label>
                <div className="flex flex-wrap gap-2">
                    {CUSTOM_MODEL_ABILITIES.map((ability) => {
                        const Icon = getAbilityIcon(ability)
                        const isSelected = form.abilities.includes(ability)
                        return (
                            <Button
                                key={ability}
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                aria-pressed={isSelected}
                                onClick={() =>
                                    setForm((prev) => ({
                                        ...prev,
                                        abilities: isSelected
                                            ? prev.abilities.filter((a) => a !== ability)
                                            : [...prev.abilities, ability]
                                    }))
                                }
                            >
                                <Icon className="h-4 w-4" />
                                {getAbilityLabel(ability)}
                            </Button>
                        )
                    })}
                </div>
            </div>

            {isOpenRouter && form.abilities.includes("reasoning") && (
                <ReasoningLevelsEditor
                    idPrefix={idPrefix}
                    levels={form.reasoningEfforts ?? []}
                    defaultLevel={form.defaultReasoningEffort}
                    onChange={(reasoningEfforts, defaultReasoningEffort) =>
                        setForm((prev) => ({ ...prev, reasoningEfforts, defaultReasoningEffort }))
                    }
                />
            )}

            <SettingsFormActions
                isSaving={isSaving}
                canSave={canSave}
                saveLabel={saveLabel}
                savingLabel={savingLabel}
                onSave={() => void handleSave()}
                onCancel={onCancel}
            />
        </div>
    )
}

export function ModelsSettingsContent() {
    const session = useSession()
    const userSettings = useConvexQuery(
        api.settings.getUserSettings,
        session.user?.id ? {} : "skip"
    )
    const updateSettings = useMutation(api.settings.updateUserSettingsPartial)
    // The provider a new model starts on, or null when not adding one.
    const [addingProviderId, setAddingProviderId] = useState<string | null>(null)
    const isAdding = addingProviderId !== null
    const [editingId, setEditingId] = useState<string | null>(null)

    const { availableModels, unavailableModels, currentProviders } =
        useAvailableModels(userSettings)

    if (!userSettings || "error" in userSettings) {
        return <ModelListSkeleton />
    }

    const builtInModels = availableModels.filter((model) => !isCustomDisplayModel(model))
    const unavailableBuiltIns = unavailableModels.filter((model) => !isCustomDisplayModel(model))
    // Every stored custom model, including ones switched off, so they can be turned back on.
    const customModels = Object.entries(userSettings.customModels ?? {})

    const providerOptions = [
        ...Object.entries(currentProviders.core)
            .filter(([id, provider]) => provider.enabled && isSupportedCustomModelCoreProvider(id))
            .map(([id]) => id),
        ...Object.entries(currentProviders.custom)
            .filter(([, provider]) => provider.enabled)
            .map(([id]) => id)
    ]

    const openRouter = currentProviders.core.openrouter
    const builtInDescription = openRouter?.enabled
        ? (openRouter.usageMode ?? "fallback") === "priority"
            ? "Using your OpenRouter key"
            : "Your OpenRouter key takes over when included usage runs out"
        : undefined

    // Show the unavailable reason once when every model shares it, per row otherwise.
    const getUnavailableReason = (model: DisplayModel) =>
        getModelRoutingDisabledReason(model) ?? "No provider configured"
    const unavailableReasons = new Set(unavailableBuiltIns.map(getUnavailableReason))
    const sharedUnavailableReason =
        unavailableReasons.size === 1 ? [...unavailableReasons][0] : undefined

    const getProviderLabel = (providerId: string) => {
        const isKnown =
            isSupportedCustomModelCoreProvider(providerId) || providerId in currentProviders.custom
        return isKnown ? getProviderDisplayName(providerId, currentProviders) : "Provider removed"
    }

    const saveCustomModel = async (modelId: string, data: CustomModelFormData, verb: string) => {
        try {
            await updateSettings({ customModelUpdates: { [modelId]: data } })
            toast.success(`${data.name} ${verb}`)
        } catch (error) {
            toast.error(`Failed to save ${data.name}`)
            console.error(error)
            throw error
        }
    }

    const handleDeleteCustomModel = async (modelId: string) => {
        try {
            await updateSettings({ customModelUpdates: { [modelId]: null } })
            toast.success("Custom model deleted")
        } catch (error) {
            toast.error("Failed to delete custom model")
            console.error(error)
        }
    }

    const hasOpenRouter = providerOptions.includes("openrouter")
    const otherProviderIds = providerOptions.filter((id) => id !== "openrouter")
    const startAdding = (providerId: string) => {
        setEditingId(null)
        setAddingProviderId(providerId)
    }

    // OpenRouter gets its own button since most custom models come from its catalog.
    const customAction = isAdding ? null : (
        <div className="flex flex-wrap justify-end gap-2">
            {otherProviderIds.length > 0 && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startAdding(otherProviderIds[0] ?? "")}
                >
                    <Plus className="size-4" />
                    Add model
                </Button>
            )}
            {hasOpenRouter ? (
                <Button size="sm" onClick={() => startAdding("openrouter")}>
                    <OpenRouterIcon className="size-4" />
                    Add OpenRouter model
                </Button>
            ) : (
                <Button variant="outline" size="sm" asChild>
                    <Link to="/settings/ai-setup" search={{ tab: "providers" }}>
                        <OpenRouterIcon className="size-4" />
                        Set up OpenRouter
                    </Link>
                </Button>
            )}
        </div>
    )

    return (
        <div className="space-y-8">
            <section className="space-y-3">
                <SettingsSectionHeader title="Custom" action={customAction} />

                {customModels.length === 0 && !isAdding && (
                    <p className="text-muted-foreground text-sm">
                        {hasOpenRouter
                            ? "Add any model from OpenRouter's catalog."
                            : "Set up OpenRouter BYOK to add any model from its catalog."}
                    </p>
                )}

                {customModels.map(([id, model]) => {
                    const name = model.name || model.modelId

                    if (editingId === id) {
                        return (
                            <Card key={id} className="gap-4 p-4 shadow-xs">
                                <h4 className="font-semibold text-sm">{name}</h4>
                                <CustomModelForm
                                    idPrefix={id}
                                    initial={{
                                        name: model.name || "",
                                        modelId: model.modelId,
                                        providerId: model.providerId,
                                        contextLength: model.contextLength,
                                        maxTokens: model.maxTokens,
                                        abilities: normalizeAbilities(model.abilities),
                                        enabled: model.enabled,
                                        description: model.description,
                                        reasoningEfforts: model.reasoningEfforts,
                                        defaultReasoningEffort: model.defaultReasoningEffort
                                    }}
                                    providerOptions={providerOptions}
                                    currentProviders={currentProviders}
                                    onSave={async (data) => {
                                        await saveCustomModel(id, data, "updated")
                                        setEditingId(null)
                                    }}
                                    onCancel={() => setEditingId(null)}
                                />
                            </Card>
                        )
                    }

                    const providerAvailable = isCustomModelProviderAvailable(
                        model.providerId,
                        currentProviders
                    )
                    const catalogStatus = userSettings.customModelCatalog?.[id]

                    return (
                        <ModelRow
                            key={id}
                            name={name}
                            badges={
                                catalogStatus?.expirationDate &&
                                !catalogStatus.unavailableReason ? (
                                    <ModelExpiryBadge
                                        expirationDate={catalogStatus.expirationDate}
                                        className="px-1.5 text-xs"
                                    />
                                ) : undefined
                            }
                            abilities={normalizeAbilities(model.abilities)}
                            dimmed={
                                !model.enabled ||
                                !providerAvailable ||
                                Boolean(catalogStatus?.unavailableReason)
                            }
                            meta={
                                catalogStatus?.unavailableReason ? (
                                    <span className="text-muted-foreground text-xs">
                                        {catalogStatus.unavailableReason}
                                    </span>
                                ) : model.enabled ? (
                                    <span
                                        className={cn(
                                            "text-xs",
                                            providerAvailable
                                                ? "text-foreground"
                                                : "text-muted-foreground"
                                        )}
                                    >
                                        {providerAvailable
                                            ? getProviderLabel(model.providerId)
                                            : `${getProviderLabel(model.providerId)} is off`}
                                    </span>
                                ) : (
                                    <StatusDot active={false} label="Hidden" />
                                )
                            }
                            actions={
                                <>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Edit ${name}`}
                                        onClick={() => {
                                            setAddingProviderId(null)
                                            setEditingId(id)
                                        }}
                                    >
                                        <Pencil className="size-4" />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Delete ${name}`}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This can't be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => void handleDeleteCustomModel(id)}
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                    Delete
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </>
                            }
                        />
                    )
                })}

                {isAdding && (
                    <Card className="gap-4 p-4 shadow-xs">
                        <h4 className="font-semibold text-sm">New model</h4>
                        <CustomModelForm
                            idPrefix="new-custom-model"
                            initial={{ ...EMPTY_CUSTOM_MODEL, providerId: addingProviderId }}
                            providerOptions={providerOptions}
                            currentProviders={currentProviders}
                            saveLabel="Add model"
                            savingLabel="Adding..."
                            onSave={async (data) => {
                                await saveCustomModel(`custom-${Date.now()}`, data, "added")
                                setAddingProviderId(null)
                            }}
                            onCancel={() => setAddingProviderId(null)}
                        />
                    </Card>
                )}
            </section>

            <section className="space-y-3">
                <SettingsSectionHeader title="Built-in" description={builtInDescription} />
                {builtInModels.map((model) => (
                    <SharedModelRow key={model.id} model={model} />
                ))}
            </section>

            {unavailableBuiltIns.length > 0 && (
                <section className="space-y-3">
                    <SettingsSectionHeader
                        title="Unavailable"
                        description={sharedUnavailableReason}
                    />
                    {unavailableBuiltIns.map((model) => (
                        <SharedModelRow
                            key={model.id}
                            model={model}
                            dimmed
                            meta={
                                sharedUnavailableReason ? undefined : (
                                    <span className="text-muted-foreground text-xs">
                                        {getUnavailableReason(model)}
                                    </span>
                                )
                            }
                        />
                    ))}
                </section>
            )}
        </div>
    )
}
