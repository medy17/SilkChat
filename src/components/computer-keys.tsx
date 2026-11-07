import {
    ClaudeIcon,
    CloudflareIcon,
    GeminiIcon,
    GithubIcon,
    OpenAIIcon,
    OpenRouterIcon,
    StripeIcon,
    VercelIcon
} from "@/components/brand-icons"
import { ComputerDisclosure } from "@/components/computer-ui"
import { SecretField } from "@/components/settings/secret-field"
import { SettingsFormActions, SettingsSectionHeader } from "@/components/settings/settings-section"
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
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
    COMPUTER_KEY_PRESETS,
    CUSTOM_COMPUTER_KEY_ID,
    type ComputerKeyPreset,
    getComputerKeyExpiry
} from "@/convex/lib/computer_keys"
import { Link } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import { endOfDay, startOfDay } from "date-fns"
import { ExternalLink, Key, Plus, Trash2 } from "lucide-react"
import { type ComponentType, useState } from "react"
import { toast } from "sonner"

type KeyRow = NonNullable<ReturnType<typeof useMyKeys>>[number]

const useMyKeys = () => useQuery(api.computer_keys.listMyComputerKeys)

const SERVICE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
    github: GithubIcon,
    openai: OpenAIIcon,
    anthropic: ClaudeIcon,
    google: GeminiIcon,
    openrouter: OpenRouterIcon,
    stripe: StripeIcon,
    cloudflare: CloudflareIcon,
    vercel: VercelIcon
}

const showError = (error: unknown, fallback: string) =>
    toast.error(error instanceof Error ? error.message : fallback)

function ExpiryField({
    id,
    value,
    onChange
}: {
    id: string
    value: Date | undefined
    onChange: (date: Date | undefined) => void
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>Expires on</Label>
            <DatePicker
                id={id}
                minDate={startOfDay(new Date())}
                placeholder="No expiry"
                value={value}
                onChange={onChange}
            />
        </div>
    )
}

function KeyHelp({ preset }: { preset: ComputerKeyPreset }) {
    return (
        <div className="space-y-2">
            <a
                href={preset.helpUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-sm underline underline-offset-4"
            >
                Get a {preset.label} key
                <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
            <ComputerDisclosure label="How do I get one?">
                <p className="text-muted-foreground text-xs">{preset.help}</p>
            </ComputerDisclosure>
        </div>
    )
}

/** One service or custom key, on the same card and flow as a provider key. */
function KeyCard({
    label,
    host,
    icon: Icon,
    item,
    preset
}: {
    label: string
    host: string
    icon: ComponentType<{ className?: string }>
    item?: KeyRow
    preset?: ComputerKeyPreset
}) {
    const add = useMutation(api.computer_keys.addMyComputerKey)
    const replace = useMutation(api.computer_keys.replaceMyComputerKey)
    const setEnabled = useMutation(api.computer_keys.setMyComputerKeyEnabled)
    const setExpiry = useMutation(api.computer_keys.setMyComputerKeyExpiry)
    const remove = useMutation(api.computer_keys.removeMyComputerKey)

    // Setting up: switched on with no saved key, so the key field is open and the key only
    // turns on once it's saved.
    const [isSettingUp, setIsSettingUp] = useState(false)
    const [isReplacing, setIsReplacing] = useState(false)
    const [newKey, setNewKey] = useState("")
    const [expiresOn, setExpiresOn] = useState<Date>()
    const [pending, setPending] = useState(false)

    const isEnabled = item?.enabled === true
    const isEditing = isSettingUp || isReplacing
    const keyId = item?._id as Id<"computerKeys">
    const expiry = getComputerKeyExpiry(item?.expiresAt, Date.now())
    const expiring = isEnabled && expiry !== null && expiry.state !== "ok"

    const closeEditor = () => {
        setIsSettingUp(false)
        setIsReplacing(false)
        setNewKey("")
        setExpiresOn(undefined)
    }

    const run = async (work: () => Promise<unknown>, message?: string) => {
        setPending(true)
        try {
            await work()
            if (message) toast.success(message)
            return true
        } catch (error) {
            showError(error, "Couldn't update that key")
            return false
        } finally {
            setPending(false)
        }
    }

    const handleToggle = (checked: boolean) => {
        if (!checked && isSettingUp) {
            closeEditor()
            return
        }
        if (checked && !item) {
            setIsSettingUp(true)
            return
        }
        closeEditor()
        void run(
            () => setEnabled({ keyId, enabled: checked }),
            `${label} turned ${checked ? "on" : "off"}`
        )
    }

    const handleSave = async () => {
        const saved = await run(
            () =>
                item
                    ? replace({ keyId, value: newKey })
                    : add({
                          presetId: preset?.id ?? CUSTOM_COMPUTER_KEY_ID,
                          value: newKey,
                          expiresAt: expiresOn ? endOfDay(expiresOn).getTime() : undefined
                      }),
            item ? `${label} key replaced` : `${label} turned on`
        )
        if (saved) closeEditor()
    }

    return (
        <Card className="gap-4 p-4 shadow-xs">
            <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center">
                    <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm">{label}</h4>
                    {expiring ? (
                        <p className="mt-0.5 text-destructive text-xs">{expiry.label}</p>
                    ) : (
                        <p className="mt-0.5 truncate font-mono text-muted-foreground text-xs">
                            {host}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Switch
                        checked={isEnabled || isSettingUp}
                        onCheckedChange={handleToggle}
                        disabled={pending}
                        aria-label={`Let Silky use ${label}`}
                        className="mt-1.5 mr-2"
                    />
                    {item && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Delete ${label} key`}
                                    className="text-destructive hover:text-destructive"
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete {label} key?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Silky won't be able to use it. To cancel the key itself,
                                        revoke it on the service too.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() =>
                                            void run(
                                                () => remove({ keyId }),
                                                `${label} key deleted`
                                            )
                                        }
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>

            {(isEnabled || isSettingUp) && (
                <div className="space-y-4">
                    <SecretField
                        id={`computer-key-${item?._id ?? preset?.id}`}
                        hasExistingKey={Boolean(item)}
                        replacing={isReplacing}
                        onReplace={() => setIsReplacing(true)}
                        value={newKey}
                        onChange={setNewKey}
                        label="Key"
                    />
                    {item ? (
                        <ExpiryField
                            id={`computer-key-expiry-${item._id}`}
                            value={item.expiresAt ? new Date(item.expiresAt) : undefined}
                            onChange={(date) =>
                                void run(() =>
                                    setExpiry({
                                        keyId,
                                        expiresAt: date ? endOfDay(date).getTime() : undefined
                                    })
                                )
                            }
                        />
                    ) : (
                        <ExpiryField
                            id={`computer-key-expiry-${preset?.id}`}
                            value={expiresOn}
                            onChange={setExpiresOn}
                        />
                    )}
                    {isSettingUp && preset && <KeyHelp preset={preset} />}
                    {isEditing && (
                        <SettingsFormActions
                            isSaving={pending}
                            canSave={Boolean(newKey.trim())}
                            saveLabel={isSettingUp ? "Turn on" : "Save key"}
                            onSave={() => void handleSave()}
                            onCancel={closeEditor}
                        />
                    )}
                </div>
            )}
        </Card>
    )
}

function ServiceKeyCard({ preset, item }: { preset: ComputerKeyPreset; item?: KeyRow }) {
    return (
        <KeyCard
            label={preset.label}
            host={preset.routes.map((route) => route.host).join(", ")}
            icon={SERVICE_ICONS[preset.id] ?? Key}
            item={item}
            preset={preset}
        />
    )
}

function CustomKeyForm({ onDone }: { onDone: () => void }) {
    const add = useMutation(api.computer_keys.addMyComputerKey)
    const [form, setForm] = useState({
        label: "",
        host: "",
        value: "",
        headerName: "",
        valuePrefix: "Bearer ",
        envName: ""
    })
    const [expiresOn, setExpiresOn] = useState<Date>()
    const [isSaving, setIsSaving] = useState(false)

    const setField = (field: keyof typeof form, value: string) =>
        setForm((prev) => ({ ...prev, [field]: value }))

    const handleSave = async () => {
        setIsSaving(true)
        try {
            await add({
                presetId: CUSTOM_COMPUTER_KEY_ID,
                ...form,
                expiresAt: expiresOn ? endOfDay(expiresOn).getTime() : undefined
            })
            toast.success(`${form.label.trim() || form.host.trim()} turned on`)
            onDone()
        } catch (error) {
            showError(error, "Couldn't save that key")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Card className="gap-4 p-4 shadow-xs">
            <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="computer-key-custom-name">Name</Label>
                        <Input
                            id="computer-key-custom-name"
                            value={form.label}
                            onChange={(event) => setField("label", event.target.value)}
                            placeholder="My service"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="computer-key-custom-host">Web address</Label>
                        <Input
                            id="computer-key-custom-host"
                            value={form.host}
                            onChange={(event) => setField("host", event.target.value)}
                            placeholder="api.example.com"
                        />
                    </div>
                </div>
                <SecretField
                    id="computer-key-custom-value"
                    hasExistingKey={false}
                    replacing={false}
                    onReplace={() => undefined}
                    value={form.value}
                    onChange={(value) => setField("value", value)}
                    label="Key"
                />
                <ExpiryField
                    id="computer-key-custom-expiry"
                    value={expiresOn}
                    onChange={setExpiresOn}
                />
                <ComputerDisclosure label="Advanced">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="computer-key-custom-header">Header</Label>
                            <Input
                                id="computer-key-custom-header"
                                value={form.headerName}
                                onChange={(event) => setField("headerName", event.target.value)}
                                placeholder="Authorization"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="computer-key-custom-prefix">Text before the key</Label>
                            <Input
                                id="computer-key-custom-prefix"
                                value={form.valuePrefix}
                                onChange={(event) => setField("valuePrefix", event.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="computer-key-custom-env">Variable name</Label>
                            <Input
                                id="computer-key-custom-env"
                                value={form.envName}
                                onChange={(event) => setField("envName", event.target.value)}
                                placeholder="MY_API_KEY"
                            />
                        </div>
                    </div>
                </ComputerDisclosure>
                <SettingsFormActions
                    isSaving={isSaving}
                    canSave={Boolean(form.host.trim() && form.value.trim())}
                    saveLabel="Add key"
                    onSave={() => void handleSave()}
                    onCancel={onDone}
                />
            </div>
        </Card>
    )
}

export function ComputerKeysSection() {
    const keys = useMyKeys()
    const [isAdding, setIsAdding] = useState(false)
    if (!keys) return null

    const keyFor = (presetId: string) => keys.find((key) => key.presetId === presetId)
    // GitHub is what most people want first; anything already connected stays in view.
    const inView = (preset: ComputerKeyPreset) =>
        preset.id === "github" || Boolean(keyFor(preset.id))
    const moreServices = COMPUTER_KEY_PRESETS.filter((preset) => !inView(preset))
    const customKeys = keys.filter((key) => key.presetId === CUSTOM_COMPUTER_KEY_ID)

    return (
        <section className="space-y-3">
            <SettingsSectionHeader
                title="Keys"
                description={
                    <>
                        Silky can use any key that's on, without asking.{" "}
                        <Link
                            to="/settings/computer-guide"
                            className="underline underline-offset-4"
                        >
                            How keys work
                        </Link>
                    </>
                }
                action={
                    isAdding ? null : (
                        <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
                            <Plus className="h-4 w-4" />
                            Add key
                        </Button>
                    )
                }
            />
            {COMPUTER_KEY_PRESETS.filter(inView).map((preset) => (
                <ServiceKeyCard key={preset.id} preset={preset} item={keyFor(preset.id)} />
            ))}
            {customKeys.map((item) => (
                <KeyCard
                    key={item._id}
                    label={item.label}
                    host={item.hosts.join(", ")}
                    icon={Key}
                    item={item}
                />
            ))}
            {isAdding && <CustomKeyForm onDone={() => setIsAdding(false)} />}
            {moreServices.length > 0 && (
                <ComputerDisclosure label="More services">
                    <div className="space-y-3">
                        {moreServices.map((preset) => (
                            <ServiceKeyCard key={preset.id} preset={preset} />
                        ))}
                    </div>
                </ComputerDisclosure>
            )}
        </section>
    )
}
