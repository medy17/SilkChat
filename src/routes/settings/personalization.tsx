import { SettingsLayout } from "@/components/settings/settings-layout"
import { SettingsFormActions } from "@/components/settings/settings-section"
import { PersonalizationSettingsSkeleton } from "@/components/settings/settings-skeletons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { cn } from "@/lib/utils"
import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
    Angry,
    BookUser,
    CheckCircle,
    HeartHandshake,
    ListTree,
    type LucideIcon,
    Megaphone,
    MessageSquareQuote,
    Smile
} from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

type ResponseStyleLevel = "less" | "default" | "more"
type ResponseStyleField = "warmth" | "enthusiasm" | "structure" | "emoji" | "profanity"
type ResponseStyleSelection = Record<ResponseStyleField, ResponseStyleLevel>

type TextField = "name" | "additionalContext" | "aiPersonality"
type TextDraft = Record<TextField, string>

const TEXT_FIELDS = ["name", "additionalContext", "aiPersonality"] as const
const TEXT_FIELD_LABELS: Record<TextField, string> = {
    name: "Name",
    additionalContext: "About you",
    aiPersonality: "Personality"
}

type SavedPersonalization = {
    customization?: {
        name?: string
        aiPersonality?: string
        additionalContext?: string
    }
    responseStyle?: Partial<ResponseStyleSelection>
}

const RESPONSE_STYLE_LEVELS = ["less", "default", "more"] as const

const RESPONSE_STYLE_PREFERENCES = [
    {
        field: "warmth",
        label: "Warmth",
        icon: HeartHandshake,
        previews: {
            less: "Here is the answer.",
            default: "Sure — I can help with that.",
            more: "Absolutely — I’d love to help you with that."
        }
    },
    {
        field: "enthusiasm",
        label: "Enthusiasm",
        icon: Megaphone,
        previews: {
            less: "That approach should work.",
            default: "That sounds like a solid approach.",
            more: "That’s a fantastic idea — I’m excited to see it come together!"
        }
    },
    {
        field: "profanity",
        label: "Profanity",
        icon: Angry,
        previews: {
            less: "That’s really frustrating.",
            default: "That’s seriously frustrating.",
            more: "That’s pretty f**king frustrating."
        }
    },
    {
        field: "structure",
        label: "Headers & lists",
        icon: ListTree
    },
    {
        field: "emoji",
        label: "Emojis",
        icon: Smile
    }
] as const

export const Route = createFileRoute("/settings/personalization")({
    component: PersonalizationSettingsRoute
})

function PersonalizationSettingsRoute() {
    const session = useSession()
    const userSettings = useConvexQuery(
        api.settings.getUserSettings,
        session.user?.id ? {} : "skip"
    )

    return (
        <SettingsLayout
            title="Personalization"
            description="Tell SilkChat about yourself and shape how it responds."
        >
            {!userSettings ? (
                <PersonalizationSettingsSkeleton />
            ) : (
                <PersonalizationForm
                    userSettings={userSettings}
                    accountImage={session.user?.image ?? undefined}
                    accountName={session.user?.name ?? ""}
                />
            )}
        </SettingsLayout>
    )
}

const getInitials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "?"

// Inline icon plus label, styled like Usage's card headers.
function FieldLabel({
    icon: Icon,
    htmlFor,
    id,
    children
}: {
    icon: LucideIcon
    htmlFor?: string
    id?: string
    children: ReactNode
}) {
    return (
        <div className="flex items-center gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {htmlFor ? (
                <Label htmlFor={htmlFor}>{children}</Label>
            ) : (
                <span id={id} className="font-medium text-foreground text-sm">
                    {children}
                </span>
            )}
        </div>
    )
}

function toTextDraft(settings: SavedPersonalization): TextDraft {
    return {
        name: settings.customization?.name ?? "",
        additionalContext: settings.customization?.additionalContext ?? "",
        aiPersonality: settings.customization?.aiPersonality ?? ""
    }
}

function PersonalizationForm({
    userSettings,
    accountImage,
    accountName
}: {
    userSettings: SavedPersonalization
    accountImage?: string
    accountName: string
}) {
    const updateSettings = useConvexMutation(api.settings.updateUserSettingsPartial)
    const savedText = toTextDraft(userSettings)
    const [draft, setDraft] = useState(savedText)
    const [savingField, setSavingField] = useState<TextField | null>(null)
    const [updatingStyleField, setUpdatingStyleField] = useState<ResponseStyleField | null>(null)

    // Text is saved trimmed, so a field is dirty when its trimmed draft differs.
    const isDirty = (field: TextField) => draft[field].trim() !== savedText[field]

    // Follow saved changes from elsewhere for fields without unsaved edits.
    const lastSavedRef = useRef(savedText)
    const savedKey = JSON.stringify(savedText)
    // biome-ignore lint/correctness/useExhaustiveDependencies: savedKey tracks savedText by value
    useEffect(() => {
        const previous = lastSavedRef.current
        lastSavedRef.current = savedText
        setDraft((current) => {
            const next = { ...current }
            for (const field of TEXT_FIELDS) {
                if (current[field].trim() === previous[field]) next[field] = savedText[field]
            }
            return next
        })
    }, [savedKey])

    const updateDraft = (field: TextField, value: string) =>
        setDraft((current) => ({ ...current, [field]: value }))

    const cancelField = (field: TextField) => updateDraft(field, savedText[field])

    const saveField = async (field: TextField) => {
        const value = draft[field].trim()
        setSavingField(field)
        try {
            await updateSettings({ customization: { [field]: value || null } })
            updateDraft(field, value)
            toast.success(`${TEXT_FIELD_LABELS[field]} saved`)
        } catch (error) {
            console.error(`Failed to save ${field}:`, error)
            toast.error(`Failed to save ${TEXT_FIELD_LABELS[field].toLowerCase()}`)
        } finally {
            setSavingField(null)
        }
    }

    // Response style saves on click, like Privacy's model routing.
    const handleStyleChange = async (field: ResponseStyleField, level: ResponseStyleLevel) => {
        setUpdatingStyleField(field)
        try {
            await updateSettings({ responseStyle: { [field]: level === "default" ? null : level } })
            toast.success("Response style updated")
        } catch (error) {
            console.error("Failed to update response style:", error)
            toast.error("Failed to update response style")
        } finally {
            setUpdatingStyleField(null)
        }
    }

    const fieldActions = (field: TextField, className?: string) =>
        isDirty(field) ? (
            <SettingsFormActions
                isSaving={savingField === field}
                onSave={() => void saveField(field)}
                onCancel={() => cancelField(field)}
                className={className}
            />
        ) : null

    return (
        <div className="space-y-6">
            {/* Mirrors the persona editor's avatar-over-name header. */}
            <div className="flex flex-col items-center gap-4">
                <Avatar className="size-20 rounded-full border border-foreground/10 bg-secondary shadow-inner">
                    <AvatarImage src={accountImage} alt="" className="rounded-full object-cover" />
                    <AvatarFallback className="rounded-full border-0 bg-secondary text-xl shadow-none">
                        {getInitials(draft.name || accountName)}
                    </AvatarFallback>
                </Avatar>
                <Label htmlFor="name" className="sr-only">
                    Name
                </Label>
                <Input
                    id="name"
                    value={draft.name}
                    onChange={(event) => updateDraft("name", event.target.value)}
                    placeholder="What should SilkChat call you?"
                    maxLength={100}
                    className="max-w-xs text-center"
                />
                {fieldActions("name", "justify-center")}
            </div>

            <div className="space-y-6">
                <div className="space-y-3">
                    <FieldLabel icon={BookUser} htmlFor="context">
                        About you
                    </FieldLabel>
                    <Textarea
                        id="context"
                        value={draft.additionalContext}
                        onChange={(event) => updateDraft("additionalContext", event.target.value)}
                        placeholder="Your work, interests, or anything worth knowing"
                        maxLength={2000}
                        className="max-h-64"
                    />
                    {fieldActions("additionalContext", "justify-end")}
                </div>

                <div className="space-y-3">
                    <FieldLabel icon={MessageSquareQuote} htmlFor="personality">
                        Personality
                    </FieldLabel>
                    <Textarea
                        id="personality"
                        value={draft.aiPersonality}
                        onChange={(event) => updateDraft("aiPersonality", event.target.value)}
                        placeholder="Direct and concise. Push back when I'm wrong."
                        maxLength={2000}
                        className="max-h-64"
                    />
                    {fieldActions("aiPersonality", "justify-end")}
                </div>
            </div>

            {/* The divider and tile previews carry the grouping, so no visible heading. */}
            <section className="border-border border-t pt-6" aria-label="Response style">
                <div className="space-y-6">
                    {RESPONSE_STYLE_PREFERENCES.map((preference) => {
                        const selectedLevel =
                            userSettings.responseStyle?.[preference.field] ?? "default"
                        const isUpdating = updatingStyleField === preference.field

                        return (
                            <div key={preference.field} className="space-y-3">
                                <FieldLabel
                                    icon={preference.icon}
                                    id={`response-style-${preference.field}-label`}
                                >
                                    {preference.label}
                                </FieldLabel>

                                <div
                                    className="grid max-w-3xl grid-cols-3 gap-2 sm:gap-3"
                                    role="radiogroup"
                                    aria-labelledby={`response-style-${preference.field}-label`}
                                    aria-busy={isUpdating}
                                >
                                    {RESPONSE_STYLE_LEVELS.map((level) => (
                                        <ResponseStyleOption
                                            key={level}
                                            field={preference.field}
                                            level={level}
                                            isSelected={selectedLevel === level}
                                            isUpdating={isUpdating}
                                            onSelect={() =>
                                                void handleStyleChange(preference.field, level)
                                            }
                                        />
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>
        </div>
    )
}

function ResponseStyleOption({
    field,
    level,
    isSelected,
    isUpdating,
    onSelect
}: {
    field: ResponseStyleField
    level: ResponseStyleLevel
    isSelected: boolean
    isUpdating: boolean
    onSelect: () => void
}) {
    return (
        <label
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
                name={`response-style-${field}`}
                value={level}
                checked={isSelected}
                disabled={isUpdating}
                onChange={onSelect}
                className="sr-only"
            />
            <div className="flex min-w-0 flex-col gap-2">
                <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-foreground text-sm capitalize">
                        {level}
                    </span>
                    {isSelected && <CheckCircle className="ml-auto size-4 shrink-0 text-primary" />}
                </div>
                <ResponseStylePreview field={field} level={level} />
            </div>
        </label>
    )
}

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
