import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { useIsTouchDevice } from "@/hooks/use-touch-device"
import { stopHaptics } from "@/lib/haptics"
import { useHapticsSettingsStore } from "@/lib/haptics-settings-store"
import { cn } from "@/lib/utils"
import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { CheckCircle, Loader2, Save } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

type ResponseStyleLevel = "less" | "default" | "more"
type ResponseStyleField = "warmth" | "enthusiasm" | "structure" | "emoji"
type ResponseStyleSelection = Record<ResponseStyleField, ResponseStyleLevel>

const RESPONSE_STYLE_LEVELS = ["less", "default", "more"] as const
const RESPONSE_STYLE_DEFAULTS: ResponseStyleSelection = {
    warmth: "default",
    enthusiasm: "default",
    structure: "default",
    emoji: "default"
}

const RESPONSE_STYLE_PREFERENCES = [
    {
        field: "warmth",
        label: "Warmth",
        previews: {
            less: "Here is the answer.",
            default: "Sure — I can help with that.",
            more: "Absolutely — I’d love to help you with that."
        }
    },
    {
        field: "enthusiasm",
        label: "Enthusiasm",
        previews: {
            less: "That approach should work.",
            default: "That sounds like a solid approach.",
            more: "That’s a fantastic idea — I’m excited to see it come together!"
        }
    },
    {
        field: "structure",
        label: "Headers & lists"
    },
    {
        field: "emoji",
        label: "Emojis"
    }
] as const

function ResponseStylePreview({
    field,
    level
}: {
    field: ResponseStyleField
    level: ResponseStyleLevel
}) {
    if (field === "structure") {
        if (level === "less") {
            return (
                <div className="flex min-h-12 flex-col justify-center gap-1.5" aria-hidden="true">
                    <div className="h-1.5 w-full rounded-[var(--radius-sm)] bg-muted-foreground/35" />
                    <div className="h-1.5 w-5/6 rounded-[var(--radius-sm)] bg-muted-foreground/35" />
                    <div className="h-1.5 w-full rounded-[var(--radius-sm)] bg-muted-foreground/35" />
                    <div className="h-1.5 w-2/3 rounded-[var(--radius-sm)] bg-muted-foreground/35" />
                </div>
            )
        }

        if (level === "default") {
            return (
                <div className="flex min-h-12 flex-col justify-center gap-1.5" aria-hidden="true">
                    <div className="mb-0.5 h-2 w-1/3 rounded-[var(--radius-sm)] bg-foreground/55" />
                    <div className="h-1.5 w-full rounded-[var(--radius-sm)] bg-muted-foreground/35" />
                    <div className="h-1.5 w-4/5 rounded-[var(--radius-sm)] bg-muted-foreground/35" />
                </div>
            )
        }

        return (
            <div className="flex min-h-12 flex-col justify-center gap-1.5" aria-hidden="true">
                <div className="mb-0.5 h-2 w-1/3 rounded-[var(--radius-sm)] bg-foreground/55" />
                {["w-3/4", "w-1/2", "w-2/3"].map((width) => (
                    <div key={width} className="flex items-center gap-2">
                        <div className="size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                        <div
                            className={cn(
                                "h-1.5 rounded-[var(--radius-sm)] bg-muted-foreground/35",
                                width
                            )}
                        />
                    </div>
                ))}
            </div>
        )
    }

    if (field === "emoji") {
        const previews = {
            less: "—",
            default: "🙂",
            more: "🙂 ✨ 🎉"
        } as const

        return (
            <div className="flex min-h-10 items-center text-base" aria-hidden="true">
                {previews[level]}
            </div>
        )
    }

    const preference = RESPONSE_STYLE_PREFERENCES.find((item) => item.field === field)
    const preview = preference && "previews" in preference ? preference.previews[level] : ""

    return <p className="min-h-10 text-muted-foreground text-xs leading-5">{preview}</p>
}

export const Route = createFileRoute("/settings/customization")({
    component: LegacyCustomizationRedirect
})

function LegacyCustomizationRedirect() {
    const navigate = useNavigate()

    useEffect(() => {
        navigate({
            to: "/settings/behavior",
            replace: true
        })
    }, [navigate])

    return null
}

export function BehaviorSettingsContent() {
    const session = useSession()
    const isTouchDevice = useIsTouchDevice()
    const hapticsEnabled = useHapticsSettingsStore((state) => state.enabled)
    const setHapticsEnabled = useHapticsSettingsStore((state) => state.setEnabled)
    const userSettings = useConvexQuery(
        api.settings.getUserSettings,
        session.user?.id ? {} : "skip"
    )
    const updateSettings = useConvexMutation(api.settings.updateUserSettingsPartial)

    const [isSaving, setIsSaving] = useState(false)
    const [isUpdatingComposerBehavior, setIsUpdatingComposerBehavior] = useState(false)
    const [responseStyle, setResponseStyle] =
        useState<ResponseStyleSelection>(RESPONSE_STYLE_DEFAULTS)

    const nameRef = useRef<HTMLInputElement>(null)
    const personalityRef = useRef<HTMLTextAreaElement>(null)
    const contextRef = useRef<HTMLTextAreaElement>(null)
    const isResponseStyleDirtyRef = useRef(false)

    useEffect(() => {
        if (!userSettings || isResponseStyleDirtyRef.current) return

        setResponseStyle({
            warmth: userSettings.responseStyle?.warmth ?? "default",
            enthusiasm: userSettings.responseStyle?.enthusiasm ?? "default",
            structure: userSettings.responseStyle?.structure ?? "default",
            emoji: userSettings.responseStyle?.emoji ?? "default"
        })
    }, [userSettings])

    const handleSave = async () => {
        if (!session.user?.id) return

        setIsSaving(true)
        try {
            await updateSettings({
                customization: {
                    name: nameRef.current?.value.trim() || null,
                    aiPersonality: personalityRef.current?.value.trim() || null,
                    additionalContext: contextRef.current?.value.trim() || null
                },
                responseStyle: {
                    warmth: responseStyle.warmth === "default" ? null : responseStyle.warmth,
                    enthusiasm:
                        responseStyle.enthusiasm === "default" ? null : responseStyle.enthusiasm,
                    structure:
                        responseStyle.structure === "default" ? null : responseStyle.structure,
                    emoji: responseStyle.emoji === "default" ? null : responseStyle.emoji
                }
            })
            isResponseStyleDirtyRef.current = false
            toast.success("Customization settings saved")
        } catch (error) {
            console.error("Failed to save customization:", error)
            toast.error("Failed to save customization settings")
        } finally {
            setIsSaving(false)
        }
    }

    const handleComposerBehaviorToggle = async (checked: boolean) => {
        if (!session.user?.id) return

        setIsUpdatingComposerBehavior(true)
        try {
            await updateSettings({
                invertSendNewlineBehavior: checked
            })
            toast.success(
                checked
                    ? "Enter now inserts new lines by default"
                    : "Enter now sends messages by default"
            )
        } catch (error) {
            console.error("Failed to update composer behavior:", error)
            toast.error("Failed to update composer behavior")
        } finally {
            setIsUpdatingComposerBehavior(false)
        }
    }

    const handleHapticsToggle = (checked: boolean) => {
        setHapticsEnabled(checked)
        if (!checked) stopHaptics()
    }

    if (!session.user?.id) {
        return (
            <p className="text-muted-foreground text-sm">
                Sign in to customize your AI experience.
            </p>
        )
    }

    if (!userSettings) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold text-foreground">Personalization</h3>
                    {/* <p className="mt-1 text-muted-foreground text-sm">
                        Set the baseline context and communication style for the assistant.
                    </p> */}
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="name">Your Name</Label>
                        <Input
                            id="name"
                            ref={nameRef}
                            defaultValue={userSettings?.customization?.name || ""}
                            placeholder="How should the AI address you?"
                            maxLength={100}
                        />
                        {/* <p className="text-muted-foreground text-xs">
                            This helps the AI address you personally in conversations.
                        </p> */}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="personality">AI Personality</Label>
                        <Textarea
                            id="personality"
                            ref={personalityRef}
                            defaultValue={userSettings?.customization?.aiPersonality || ""}
                            placeholder="Describe how you want the AI to behave and communicate..."
                            rows={4}
                            maxLength={2000}
                        />
                        {/* <p className="text-muted-foreground text-xs">
                            Shape the AI's communication style and personality.
                        </p> */}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="context">Additional Context</Label>
                        <Textarea
                            id="context"
                            ref={contextRef}
                            defaultValue={userSettings?.customization?.additionalContext || ""}
                            placeholder="Share relevant information about yourself, your work, or preferences..."
                            rows={4}
                            maxLength={2000}
                        />
                        {/* <p className="text-muted-foreground text-xs">
                            Provide context that helps the AI give you more relevant responses.
                        </p> */}
                    </div>

                    <div className="space-y-6 pt-2">
                        <div>
                            <h3 className="font-semibold text-foreground">Response Style</h3>
                            <p className="mt-1 text-muted-foreground text-sm">
                                Fine-tune how the assistant communicates with you.
                            </p>
                        </div>

                        {RESPONSE_STYLE_PREFERENCES.map((preference) => (
                            <div key={preference.field} className="space-y-3">
                                <h4 className="font-medium text-foreground text-sm">
                                    {preference.label}
                                </h4>

                                <div
                                    className="grid max-w-3xl grid-cols-3 gap-2 sm:gap-3"
                                    role="radiogroup"
                                    aria-label={preference.label}
                                >
                                    {RESPONSE_STYLE_LEVELS.map((level) => {
                                        const isSelected = responseStyle[preference.field] === level

                                        return (
                                            <label
                                                key={level}
                                                className={cn(
                                                    "cursor-pointer rounded-[var(--radius-xl)] border-0 bg-muted/20 p-3 transition-all duration-200 hover:bg-muted/40 sm:p-4 [&:has(input:focus-visible)]:ring-2 [&:has(input:focus-visible)]:ring-ring",
                                                    isSelected
                                                        ? "bg-primary/5 ring-1 ring-primary/20"
                                                        : "hover:ring-1 hover:ring-border"
                                                )}
                                            >
                                                <input
                                                    type="radio"
                                                    name={`response-style-${preference.field}`}
                                                    value={level}
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        isResponseStyleDirtyRef.current = true
                                                        setResponseStyle((current) => ({
                                                            ...current,
                                                            [preference.field]: level
                                                        }))
                                                    }}
                                                    className="sr-only"
                                                />
                                                <div className="flex min-w-0 flex-col gap-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="truncate font-medium text-foreground text-sm capitalize">
                                                            {level}
                                                        </span>
                                                        {isSelected && (
                                                            <CheckCircle className="ml-auto size-4 shrink-0 text-primary" />
                                                        )}
                                                    </div>
                                                    <ResponseStylePreview
                                                        field={preference.field}
                                                        level={level}
                                                    />
                                                </div>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {!isTouchDevice ? (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-foreground">Composer</h3>
                                {/* <p className="mt-1 text-muted-foreground text-sm">
                                    Control how the main chat composer handles sending and line
                                    breaks.
                                </p> */}
                            </div>

                            <Card className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-base">
                                            Invert Send/New Line Behavior
                                        </Label>
                                        <div className="space-y-1 text-muted-foreground text-sm">
                                            <p>
                                                When enabled, use Enter for new lines and Cmd/Ctrl +
                                                Enter to send messages.
                                            </p>
                                            <p>
                                                When disabled, use Enter to send and Shift + Enter
                                                for new lines.
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={userSettings.invertSendNewlineBehavior === true}
                                        onCheckedChange={handleComposerBehaviorToggle}
                                        disabled={isUpdatingComposerBehavior}
                                        aria-label="Invert send and new line behavior"
                                    />
                                </div>
                            </Card>
                        </div>
                    ) : null}

                    {isTouchDevice ? (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-foreground">Interaction</h3>
                            </div>

                            <Card className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="haptics" className="text-base">
                                            Haptics
                                        </Label>
                                        <p
                                            id="haptics-description"
                                            className="text-muted-foreground text-sm"
                                        >
                                            Feel response and gesture feedback on supported devices.
                                        </p>
                                    </div>
                                    <Switch
                                        id="haptics"
                                        checked={hapticsEnabled}
                                        onCheckedChange={handleHapticsToggle}
                                        aria-label="Enable haptics"
                                        aria-describedby="haptics-description"
                                    />
                                </div>
                            </Card>
                        </div>
                    ) : null}

                    <div className="flex justify-end pt-4">
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="min-w-[6.25rem]"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
