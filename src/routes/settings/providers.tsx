import { OllamaIcon } from "@/components/brand-icons"
import { SecretField } from "@/components/settings/secret-field"
import { SettingsFormActions, SettingsSectionHeader } from "@/components/settings/settings-section"
import { ProviderListSkeleton } from "@/components/settings/settings-skeletons"
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
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { api } from "@/convex/_generated/api"
import { OLLAMA_PROVIDER_ID, normalizeOllamaBaseUrl } from "@/convex/lib/ollama"
import type { CustomProviderApiMode, GoogleAuthMode } from "@/convex/schema/settings"
import { useSession } from "@/hooks/auth-hooks"
import {
    CORE_PROVIDERS,
    type CoreProviderInfo,
    shouldShowCoreInferenceProvider,
    useAvailableModels
} from "@/lib/models-providers-shared"
import { cn } from "@/lib/utils"
import { useConvexQuery } from "@convex-dev/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation } from "convex/react"
import { Bot, CheckCircle, Pencil, Plus, Trash2 } from "lucide-react"
import { memo, useEffect, useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/settings/providers")({
    component: LegacyProvidersRedirect
})

type UsageMode = "priority" | "fallback"

const USAGE_MODE_OPTIONS: { value: UsageMode; label: string; description: string }[] = [
    { value: "priority", label: "Priority", description: "Always use your key." },
    {
        value: "fallback",
        label: "Fallback",
        description: "Use your key when included usage runs out or a chat exceeds hosted limits."
    }
]

const USAGE_MODE_LABELS: Record<UsageMode, string> = {
    priority: "Priority",
    fallback: "Fallback"
}

const USAGE_MODE_STATUS: Record<UsageMode, string> = {
    priority: "Priority: always uses your key",
    fallback: "Fallback: used when included usage runs out"
}

const API_MODE_LABELS: Record<CustomProviderApiMode, string> = {
    chat: "Chat Completions",
    responses: "Responses",
    ollama: "Ollama"
}

// Ollama has its own card, so custom providers only offer the OpenAI-compatible APIs.
const CUSTOM_PROVIDER_API_MODES: CustomProviderApiMode[] = ["chat", "responses"]

type CoreProviderSettings = {
    enabled: boolean
    encryptedKey: string
    usageMode?: UsageMode
    authMode?: GoogleAuthMode
}

type CoreProviderUpdate = {
    enabled: boolean
    newKey?: string
    authMode?: GoogleAuthMode
    usageMode?: UsageMode
}

type CustomProviderSettings = {
    name: string
    enabled: boolean
    endpoint: string
    apiMode?: CustomProviderApiMode
    encryptedKey: string
}

type CustomProviderUpdate = {
    name: string
    enabled: boolean
    endpoint: string
    apiMode: CustomProviderApiMode
    newKey?: string
    clearKey?: boolean
}

function UsageModeTiles({
    value,
    onChange,
    isUpdating = false
}: {
    value: UsageMode
    onChange: (value: UsageMode) => void
    isUpdating?: boolean
}) {
    return (
        <div className="space-y-2">
            <Label id="byok-usage-label">Use my key</Label>
            <div
                role="radiogroup"
                aria-labelledby="byok-usage-label"
                aria-busy={isUpdating}
                className="grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3"
            >
                {USAGE_MODE_OPTIONS.map((option) => {
                    const isSelected = value === option.value

                    return (
                        <label
                            key={option.value}
                            className={cn(
                                "cursor-pointer rounded-[var(--radius-xl)] border-0 bg-muted/20 p-3 transition-all duration-200 hover:bg-muted/40 sm:p-4 [&:has(input:focus-visible)]:ring-2 [&:has(input:focus-visible)]:ring-ring",
                                isSelected
                                    ? "bg-primary/5 ring-1 ring-primary/20"
                                    : "hover:ring-1 hover:ring-border",
                                isUpdating && "cursor-wait opacity-60"
                            )}
                        >
                            <input
                                type="radio"
                                name="byok-usage-mode"
                                value={option.value}
                                checked={isSelected}
                                disabled={isUpdating}
                                onChange={() => onChange(option.value)}
                                className="sr-only"
                            />
                            <div className="flex min-w-0 flex-col gap-2">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-foreground text-sm">
                                        {option.label}
                                    </span>
                                    {isSelected && (
                                        <CheckCircle className="ml-auto size-4 shrink-0 text-primary" />
                                    )}
                                </div>
                                <p className="text-muted-foreground text-xs leading-5">
                                    {option.description}
                                </p>
                            </div>
                        </label>
                    )
                })}
            </div>
            <p className="text-muted-foreground text-xs">
                Voice transcription also tries your key first.
            </p>
        </div>
    )
}

const ProviderCard = memo(
    ({
        provider,
        currentProvider,
        onSave
    }: {
        provider: CoreProviderInfo
        currentProvider?: CoreProviderSettings
        onSave: (providerId: string, update: CoreProviderUpdate, message: string) => Promise<void>
    }) => {
        const defaultAuthMode = provider.authModes?.[0]?.value
        const isEnabled = currentProvider?.enabled === true
        const hasExistingKey = Boolean(currentProvider?.encryptedKey)
        const savedUsageMode = currentProvider?.usageMode ?? "fallback"

        // Setting up: switched on with no saved key, so the key field is open and the
        // provider only turns on once the key is saved.
        const [isSettingUp, setIsSettingUp] = useState(false)
        const [isReplacingKey, setIsReplacingKey] = useState(false)
        const [newKey, setNewKey] = useState("")
        const [authMode, setAuthMode] = useState<GoogleAuthMode | undefined>(
            currentProvider?.authMode ?? defaultAuthMode
        )
        const [setupUsageMode, setSetupUsageMode] = useState<UsageMode>(savedUsageMode)
        const [pending, setPending] = useState<"toggle" | "usage" | "key" | null>(null)

        // Also covers a provider saved as on without a key, which needs one to work.
        const isEditingKey = isSettingUp || isReplacingKey || (isEnabled && !hasExistingKey)
        const selectedAuthConfig = provider.authModes?.find((mode) => mode.value === authMode)
        const isVertex = authMode === "vertex"
        const Icon = provider.icon

        const run = async (
            kind: "toggle" | "usage" | "key",
            update: CoreProviderUpdate,
            message: string
        ) => {
            setPending(kind)
            try {
                await onSave(provider.id, update, message)
                return true
            } catch {
                // The parent reports the error.
                return false
            } finally {
                setPending(null)
            }
        }

        const closeKeyEditor = () => {
            setIsSettingUp(false)
            setIsReplacingKey(false)
            setNewKey("")
            setAuthMode(currentProvider?.authMode ?? defaultAuthMode)
        }

        const handleToggle = (checked: boolean) => {
            if (!checked && isSettingUp) {
                closeKeyEditor()
                return
            }
            if (checked && !hasExistingKey) {
                setSetupUsageMode(savedUsageMode)
                setIsSettingUp(true)
                return
            }
            closeKeyEditor()
            void run(
                "toggle",
                { enabled: checked },
                `${provider.name} turned ${checked ? "on" : "off"}`
            )
        }

        const handleSaveKey = async () => {
            const saved = await run(
                "key",
                {
                    enabled: true,
                    newKey: newKey.trim(),
                    authMode,
                    ...(isSettingUp ? { usageMode: setupUsageMode } : {})
                },
                isSettingUp ? `${provider.name} turned on` : `${provider.name} key replaced`
            )
            if (saved) closeKeyEditor()
        }

        const status =
            provider.id === "openrouter" && isEnabled
                ? USAGE_MODE_STATUS[savedUsageMode]
                : provider.description

        return (
            <Card className="gap-4 p-4 shadow-xs">
                <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center">
                        {typeof Icon === "string" ? null : <Icon className="size-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm">{provider.name}</h4>
                        <p className="mt-0.5 text-muted-foreground text-xs">{status}</p>
                    </div>
                    <Switch
                        checked={isEnabled || isSettingUp}
                        onCheckedChange={handleToggle}
                        disabled={pending !== null}
                        aria-label={`Use ${provider.name}`}
                        className="mt-1.5 shrink-0"
                    />
                </div>

                {(isEnabled || isSettingUp) && (
                    <div className="space-y-4">
                        {provider.id === "openrouter" &&
                            (isSettingUp ? (
                                <UsageModeTiles
                                    value={setupUsageMode}
                                    onChange={setSetupUsageMode}
                                />
                            ) : (
                                <UsageModeTiles
                                    value={savedUsageMode}
                                    isUpdating={pending === "usage"}
                                    onChange={(usageMode) =>
                                        void run(
                                            "usage",
                                            { enabled: true, usageMode },
                                            `${provider.name} set to ${USAGE_MODE_LABELS[usageMode]}`
                                        )
                                    }
                                />
                            ))}

                        {isEditingKey && provider.authModes && provider.authModes.length > 0 && (
                            <div className="space-y-2">
                                <Label htmlFor={`${provider.id}-auth-mode`}>Authentication</Label>
                                <Select
                                    value={authMode}
                                    onValueChange={(value) => setAuthMode(value as GoogleAuthMode)}
                                >
                                    <SelectTrigger id={`${provider.id}-auth-mode`}>
                                        <SelectValue placeholder="Select a mode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {provider.authModes.map((mode) => (
                                            <SelectItem key={mode.value} value={mode.value}>
                                                {mode.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedAuthConfig && (
                                    <p className="text-muted-foreground text-xs">
                                        {selectedAuthConfig.description}
                                    </p>
                                )}
                            </div>
                        )}

                        <SecretField
                            id={`${provider.id}-key`}
                            hasExistingKey={hasExistingKey}
                            replacing={isReplacingKey}
                            onReplace={() => setIsReplacingKey(true)}
                            value={newKey}
                            onChange={setNewKey}
                            label={isVertex ? "Credentials JSON" : "API Key"}
                            placeholder={selectedAuthConfig?.placeholder || provider.placeholder}
                            multiline={isVertex}
                        />

                        {isEditingKey && (
                            <SettingsFormActions
                                isSaving={pending === "key"}
                                canSave={Boolean(newKey.trim())}
                                saveLabel={isSettingUp ? "Turn on" : "Save key"}
                                onSave={() => void handleSaveKey()}
                                onCancel={closeKeyEditor}
                            />
                        )}
                    </div>
                )}
            </Card>
        )
    }
)

function CustomProviderForm({
    idPrefix,
    initial,
    hasExistingKey,
    saveLabel,
    savingLabel,
    onSave,
    onCancel
}: {
    idPrefix: string
    initial: Omit<CustomProviderUpdate, "newKey">
    hasExistingKey: boolean
    saveLabel?: string
    savingLabel?: string
    onSave: (update: CustomProviderUpdate) => Promise<void>
    onCancel: () => void
}) {
    const [form, setForm] = useState({ ...initial, newKey: "" })
    const [replacingKey, setReplacingKey] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // A replacement left empty keeps the saved key.
    const hasKey = hasExistingKey || Boolean(form.newKey.trim())
    const canSave =
        Boolean(form.name.trim()) && Boolean(form.endpoint.trim()) && (!form.enabled || hasKey)

    const handleSave = async () => {
        setIsSaving(true)
        try {
            await onSave({
                name: form.name.trim(),
                enabled: form.enabled,
                endpoint: form.endpoint.trim(),
                apiMode: form.apiMode,
                newKey: form.newKey.trim() || undefined
            })
        } catch {
            // The parent reports the error; keep the form open.
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-name`}>Name</Label>
                    <Input
                        id={`${idPrefix}-name`}
                        value={form.name}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        placeholder="My provider"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-endpoint`}>Base URL</Label>
                    <Input
                        id={`${idPrefix}-endpoint`}
                        value={form.endpoint}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, endpoint: event.target.value }))
                        }
                        placeholder="https://api.example.com/v1"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-api-mode`}>API</Label>
                <Select
                    value={form.apiMode}
                    onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, apiMode: value as CustomProviderApiMode }))
                    }
                >
                    <SelectTrigger id={`${idPrefix}-api-mode`}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {CUSTOM_PROVIDER_API_MODES.map((mode) => (
                            <SelectItem key={mode} value={mode}>
                                {API_MODE_LABELS[mode]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <SecretField
                id={`${idPrefix}-key`}
                hasExistingKey={hasExistingKey}
                replacing={replacingKey}
                onReplace={() => setReplacingKey(true)}
                value={form.newKey}
                onChange={(newKey) => setForm((prev) => ({ ...prev, newKey }))}
                placeholder={replacingKey ? "Leave empty to keep the saved key" : "sk-..."}
            />

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

const CustomProviderCard = memo(
    ({
        providerId,
        provider,
        onSave,
        onDelete
    }: {
        providerId: string
        provider: CustomProviderSettings
        onSave: (providerId: string, update: CustomProviderUpdate, message: string) => Promise<void>
        onDelete: (providerId: string) => Promise<void>
    }) => {
        // Editing opens the form; "enable" is editing opened by switching on without a key.
        const [editMode, setEditMode] = useState<"edit" | "enable" | null>(null)
        const [isToggling, setIsToggling] = useState(false)
        const apiMode = provider.apiMode ?? "chat"
        const hasExistingKey = Boolean(provider.encryptedKey)

        const handleToggle = async (checked: boolean) => {
            if (!checked && editMode === "enable") {
                setEditMode(null)
                return
            }
            if (checked && !hasExistingKey) {
                setEditMode("enable")
                return
            }
            setIsToggling(true)
            try {
                await onSave(
                    providerId,
                    { name: provider.name, enabled: checked, endpoint: provider.endpoint, apiMode },
                    `${provider.name} turned ${checked ? "on" : "off"}`
                )
            } catch {
                // The parent reports the error.
            } finally {
                setIsToggling(false)
            }
        }

        return (
            <Card className="gap-4 p-4 shadow-xs">
                <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center">
                        <Bot className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm">{provider.name}</h4>
                        <p className="mt-0.5 truncate text-muted-foreground text-xs">
                            <span className="font-mono">{provider.endpoint}</span>
                            {" · "}
                            {API_MODE_LABELS[apiMode]}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <Switch
                            checked={provider.enabled || editMode === "enable"}
                            onCheckedChange={(checked) => void handleToggle(checked)}
                            disabled={isToggling}
                            aria-label={`Use ${provider.name}`}
                            className="mr-2"
                        />
                        {editMode === null && (
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit ${provider.name}`}
                                onClick={() => setEditMode("edit")}
                            >
                                <Pencil className="size-4" />
                            </Button>
                        )}
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Delete ${provider.name}`}
                                    className="text-destructive hover:text-destructive"
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete {provider.name}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Custom models that use this provider will stop working.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => void onDelete(providerId)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>

                {editMode && (
                    <CustomProviderForm
                        idPrefix={providerId}
                        initial={{
                            name: provider.name,
                            enabled: provider.enabled || editMode === "enable",
                            endpoint: provider.endpoint,
                            apiMode
                        }}
                        hasExistingKey={hasExistingKey}
                        saveLabel={editMode === "enable" ? "Turn on" : undefined}
                        onSave={async (update) => {
                            await onSave(
                                providerId,
                                update,
                                editMode === "enable"
                                    ? `${update.name} turned on`
                                    : `${update.name} updated`
                            )
                            setEditMode(null)
                        }}
                        onCancel={() => setEditMode(null)}
                    />
                )}
            </Card>
        )
    }
)

// Set up like OpenRouter, but with the server address alongside the key. Stored as a custom
// provider on Ollama's API, so it runs through the same path as any custom provider.
function OllamaProviderCard({
    provider,
    onSave
}: {
    provider?: CustomProviderSettings
    onSave: (update: CustomProviderUpdate, message: string) => Promise<void>
}) {
    const isEnabled = provider?.enabled === true
    const savedEndpoint = provider?.endpoint ?? ""
    const hasExistingKey = Boolean(provider?.encryptedKey)

    // "setup" is switching on with no server saved; "edit" changes the server or key.
    const [editMode, setEditMode] = useState<"setup" | "edit" | null>(null)
    const [endpoint, setEndpoint] = useState(savedEndpoint)
    const [newKey, setNewKey] = useState("")
    const [replacingKey, setReplacingKey] = useState(false)
    // Removing the saved key, for a server that doesn't need one.
    const [removingKey, setRemovingKey] = useState(false)
    const [pending, setPending] = useState(false)

    const closeEditor = () => {
        setEditMode(null)
        setEndpoint(savedEndpoint)
        setNewKey("")
        setReplacingKey(false)
        setRemovingKey(false)
    }

    const save = async (
        update: Omit<CustomProviderUpdate, "name" | "apiMode">,
        message: string
    ) => {
        setPending(true)
        try {
            await onSave({ ...update, name: "Ollama", apiMode: "ollama" }, message)
            return true
        } catch {
            // The parent reports the error.
            return false
        } finally {
            setPending(false)
        }
    }

    const handleToggle = (checked: boolean) => {
        if (!checked && editMode === "setup") {
            closeEditor()
            return
        }
        if (checked && !savedEndpoint) {
            setEditMode("setup")
            return
        }
        closeEditor()
        void save(
            { enabled: checked, endpoint: savedEndpoint },
            `Ollama turned ${checked ? "on" : "off"}`
        )
    }

    const handleSaveEditor = async () => {
        const saved = await save(
            {
                enabled: true,
                endpoint: normalizeOllamaBaseUrl(endpoint),
                newKey: newKey.trim() || undefined,
                clearKey: removingKey && !newKey.trim()
            },
            editMode === "setup" ? "Ollama turned on" : "Ollama updated"
        )
        if (saved) closeEditor()
    }

    return (
        <Card className="gap-4 p-4 shadow-xs">
            <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center">
                    <OllamaIcon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm">Ollama</h4>
                    <p className="mt-0.5 truncate text-muted-foreground text-xs">
                        {savedEndpoint ? (
                            <span className="font-mono">{savedEndpoint}</span>
                        ) : (
                            "Use models from your own Ollama server"
                        )}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Switch
                        checked={isEnabled || editMode === "setup"}
                        onCheckedChange={handleToggle}
                        disabled={pending}
                        aria-label="Use Ollama"
                        className="mr-2"
                    />
                    {savedEndpoint && editMode === null && (
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit Ollama"
                            onClick={() => setEditMode("edit")}
                        >
                            <Pencil className="size-4" />
                        </Button>
                    )}
                </div>
            </div>

            {editMode && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="ollama-endpoint">Server URL</Label>
                        <Input
                            id="ollama-endpoint"
                            value={endpoint}
                            onChange={(event) => setEndpoint(event.target.value)}
                            placeholder="https://ollama.example.com"
                            className="font-mono"
                        />
                    </div>
                    <SecretField
                        id="ollama-key"
                        hasExistingKey={hasExistingKey && !removingKey}
                        replacing={replacingKey}
                        onReplace={() => setReplacingKey(true)}
                        onRemove={() => setRemovingKey(true)}
                        value={newKey}
                        onChange={setNewKey}
                        placeholder={
                            replacingKey && !removingKey
                                ? "Leave empty to keep the saved key"
                                : "Leave empty if your server has no key"
                        }
                    />
                    <SettingsFormActions
                        isSaving={pending}
                        canSave={Boolean(endpoint.trim())}
                        saveLabel={editMode === "setup" ? "Turn on" : undefined}
                        onSave={() => void handleSaveEditor()}
                        onCancel={closeEditor}
                    />
                </div>
            )}
        </Card>
    )
}

function LegacyProvidersRedirect() {
    const navigate = useNavigate()

    useEffect(() => {
        navigate({
            to: "/settings/ai-setup",
            search: { tab: "providers" },
            replace: true
        })
    }, [navigate])

    return null
}

export function ProvidersSettingsContent() {
    const session = useSession()
    const userSettings = useConvexQuery(
        api.settings.getUserSettings,
        session.user?.id ? {} : "skip"
    )
    const updateSettings = useMutation(api.settings.updateUserSettingsPartial)
    const [isAddingCustomProvider, setIsAddingCustomProvider] = useState(false)

    const { currentProviders } = useAvailableModels(
        userSettings && !("error" in userSettings) ? userSettings : undefined
    )
    const customProviders = Object.entries(currentProviders.custom).filter(
        ([id]) => id !== OLLAMA_PROVIDER_ID
    )

    // Handlers rethrow so the card or form keeps its edits open on failure.
    const handleSaveProvider = async (
        providerId: string,
        update: CoreProviderUpdate,
        message: string
    ) => {
        try {
            await updateSettings({ coreProviderUpdates: { [providerId]: update } })
            toast.success(message)
        } catch (error) {
            toast.error("Failed to save provider settings")
            console.error(error)
            throw error
        }
    }

    const handleSaveCustomProvider = async (
        providerId: string,
        update: CustomProviderUpdate,
        message: string
    ) => {
        try {
            await updateSettings({ customProviderUpdates: { [providerId]: update } })
            toast.success(message)
        } catch (error) {
            toast.error("Failed to save custom provider")
            console.error(error)
            throw error
        }
    }

    const handleAddCustomProvider = async (update: CustomProviderUpdate) => {
        try {
            await updateSettings({ customProviderUpdates: { [`custom-${Date.now()}`]: update } })
            toast.success(`${update.name} added`)
            setIsAddingCustomProvider(false)
        } catch (error) {
            toast.error("Failed to add custom provider")
            console.error(error)
            throw error
        }
    }

    const handleDeleteCustomProvider = async (providerId: string) => {
        try {
            await updateSettings({ customProviderUpdates: { [providerId]: null } })
            toast.success("Custom provider deleted")
        } catch (error) {
            toast.error("Failed to delete custom provider")
            console.error(error)
        }
    }

    if (!userSettings || "error" in userSettings) {
        return <ProviderListSkeleton />
    }

    return (
        <div className="space-y-8">
            <section className="space-y-3">
                <SettingsSectionHeader title="Bring your own key" />
                {CORE_PROVIDERS.filter(shouldShowCoreInferenceProvider).map((provider) => (
                    <ProviderCard
                        key={provider.id}
                        provider={provider}
                        currentProvider={currentProviders.core[provider.id]}
                        onSave={handleSaveProvider}
                    />
                ))}
            </section>

            <section className="space-y-3">
                <SettingsSectionHeader title="Self-hosted" />
                <OllamaProviderCard
                    provider={currentProviders.custom[OLLAMA_PROVIDER_ID]}
                    onSave={(update, message) =>
                        handleSaveCustomProvider(OLLAMA_PROVIDER_ID, update, message)
                    }
                />
            </section>

            <section className="space-y-3">
                <SettingsSectionHeader
                    title="Custom providers"
                    action={
                        isAddingCustomProvider ? null : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsAddingCustomProvider(true)}
                            >
                                <Plus className="size-4" />
                                Add provider
                            </Button>
                        )
                    }
                />

                {customProviders.length === 0 && !isAddingCustomProvider && (
                    <p className="text-muted-foreground text-sm">
                        Connect any OpenAI-compatible endpoint.
                    </p>
                )}

                {customProviders.map(([id, provider]) => (
                    <CustomProviderCard
                        key={id}
                        providerId={id}
                        provider={provider}
                        onSave={handleSaveCustomProvider}
                        onDelete={handleDeleteCustomProvider}
                    />
                ))}

                {isAddingCustomProvider && (
                    <Card className="gap-4 p-4 shadow-xs">
                        <h4 className="font-semibold text-sm">New provider</h4>
                        <CustomProviderForm
                            idPrefix="new-custom-provider"
                            initial={{ name: "", enabled: true, endpoint: "", apiMode: "chat" }}
                            hasExistingKey={false}
                            saveLabel="Add provider"
                            savingLabel="Adding..."
                            onSave={handleAddCustomProvider}
                            onCancel={() => setIsAddingCustomProvider(false)}
                        />
                    </Card>
                )}
            </section>
        </div>
    )
}
