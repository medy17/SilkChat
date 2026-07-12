"use client"

import { LogoMark } from "@/components/logo"
import {
    type PersonaAvatarCropState,
    PersonaAvatarCropper,
    compressPersonaAvatar,
    cropPersonaAvatarToSquare,
    readPersonaAvatarAsDataUrl
} from "@/components/persona-avatar-cropper"
import { SplashScreen } from "@/components/splash-screen"
import { ThemeSwitcher } from "@/components/themes/theme-switcher"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import { useSession, useToken } from "@/hooks/auth-hooks"
import { useAvatarAccent } from "@/hooks/use-avatar-accent"
import { resolveJwtToken } from "@/lib/auth-token"
import { browserEnv } from "@/lib/browser-env"
import { PERSONA_ONBOARDING_PATH, setPersonaOnboardingHandoff } from "@/lib/persona-onboarding"
import { BUILT_IN_PERSONAS, type BuiltInPersona } from "@/lib/personas/builtins"
import { cn } from "@/lib/utils"
import { useConvexMutation } from "@convex-dev/react-query"
import { Link, Navigate, createLazyFileRoute, useNavigate } from "@tanstack/react-router"
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Loader2,
    MessageCircle,
    Plus,
    Save,
    Upload
} from "lucide-react"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { type CSSProperties, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

export const Route = createLazyFileRoute("/personas_/start")({
    component: PersonaOnboarding
})

const FEATURED_PERSONA_IDS = [
    "elara-adventurer",
    "lucian-vampire",
    "seraphine-fae",
    "nyx-netrunner",
    "brooding-stranger"
]

const PERSONA_METADATA: Record<string, string[]> = {
    "elara-adventurer": ["Fantasy", "Adventure", "Protective"],
    "lucian-vampire": ["Gothic", "Romance", "Dangerous"],
    "seraphine-fae": ["Fantasy", "Fae", "Enchanting"],
    "nyx-netrunner": ["Cyberpunk", "Hacker", "Sardonic"],
    "brooding-stranger": ["Contemporary", "Slow burn", "Brooding"]
}

type CreateForm = {
    name: string
    shortName: string
    description: string
    instructions: string
    starters: [string, string]
}

const EMPTY_CREATE_FORM: CreateForm = {
    name: "",
    shortName: "",
    description: "",
    instructions: "",
    starters: ["", ""]
}

type PersonaAvatarUpload = {
    key: string
    fileName: string
    fileType: "image/avif" | "image/webp" | "image/jpeg" | "image/png"
    fileSize: number
}

function AvatarUploadArea({
    id,
    previewUrl,
    onFile,
    className
}: {
    id: string
    previewUrl: string | null
    onFile: (file: File) => void
    className?: string
}) {
    return (
        <label
            htmlFor={id}
            style={previewUrl ? { borderColor: "var(--persona-accent)" } : undefined}
            className={cn(
                "group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-lg)] border-2 border-border border-dashed bg-muted text-muted-foreground transition-colors hover:border-[var(--persona-accent)] hover:text-[var(--persona-accent)]",
                className
            )}
        >
            {previewUrl ? (
                <>
                    <img
                        src={previewUrl}
                        alt="Avatar preview"
                        className="size-full object-contain"
                    />
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-background/85 px-3 py-2 font-medium text-xs backdrop-blur">
                        <Upload className="size-3.5" />
                        Replace image
                    </span>
                </>
            ) : (
                <span className="flex flex-col items-center gap-3 text-center">
                    <span className="flex size-14 items-center justify-center rounded-[var(--radius-xl)] border border-current">
                        <Upload className="size-5" />
                    </span>
                    <span>
                        <span className="block font-medium text-foreground text-sm">
                            Add an avatar
                        </span>
                        <span className="mt-1 block text-xs">PNG, JPG, WebP or AVIF</span>
                    </span>
                </span>
            )}
            <input
                id={id}
                type="file"
                accept=".avif,.webp,.jpg,.jpeg,.png,image/avif,image/webp,image/jpeg,image/png"
                className="sr-only"
                onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) onFile(file)
                    event.target.value = ""
                }}
            />
        </label>
    )
}

function MobileAvatarUploadButton({
    id,
    previewUrl,
    onFile
}: {
    id: string
    previewUrl: string | null
    onFile: (file: File) => void
}) {
    return (
        <label
            htmlFor={id}
            style={previewUrl ? { borderColor: "var(--persona-accent)" } : undefined}
            className="relative flex size-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border bg-background text-muted-foreground transition-colors hover:border-[var(--persona-accent)] hover:text-[var(--persona-accent)] sm:hidden"
            aria-label={previewUrl ? "Replace persona avatar" : "Upload persona avatar"}
        >
            {previewUrl ? (
                <img src={previewUrl} alt="Avatar preview" className="size-full object-cover" />
            ) : (
                <Upload className="size-4" />
            )}
            {previewUrl ? (
                <span className="absolute right-0 bottom-0 flex size-5 items-center justify-center rounded-full border bg-background">
                    <Upload className="size-3" />
                </span>
            ) : null}
            <input
                id={id}
                type="file"
                accept=".avif,.webp,.jpg,.jpeg,.png,image/avif,image/webp,image/jpeg,image/png"
                className="sr-only"
                onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) onFile(file)
                    event.target.value = ""
                }}
            />
        </label>
    )
}

function PersonaOnboarding() {
    const { data: session, isPending } = useSession()
    const { token } = useToken()
    const navigate = useNavigate()
    const personas = useMemo(
        () =>
            FEATURED_PERSONA_IDS.map((id) =>
                BUILT_IN_PERSONAS.find((persona) => persona.id === id)
            ).filter((persona): persona is BuiltInPersona => Boolean(persona)),
        []
    )
    const createPersona = useConvexMutation(api.personas.createUserPersona)
    const completeOnboarding = useConvexMutation(api.settings.completeOnboarding)
    const [selectedPersonaId, setSelectedPersonaId] = useState(personas[0]?.id ?? "")
    const [isCreating, setIsCreating] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE_FORM)
    const [avatarFile, setAvatarFile] = useState<File | null>(null)
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
    const [avatarCropState, setAvatarCropState] = useState<PersonaAvatarCropState | null>(null)
    const [isCroppingAvatar, setIsCroppingAvatar] = useState(false)
    const selectedPersona =
        personas.find((persona) => persona.id === selectedPersonaId) ?? personas[0]
    const avatarAccent = useAvatarAccent(
        isCreating ? avatarPreviewUrl : selectedPersona?.avatarPath
    )
    const accentStyle = {
        "--persona-accent": avatarAccent
    } as CSSProperties
    const [selectedStarter, setSelectedStarter] = useState(
        selectedPersona?.conversationStarters[0] ?? ""
    )

    useEffect(
        () => () => {
            if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
        },
        [avatarPreviewUrl]
    )

    const setAvatarPreview = (file: File) => {
        setAvatarFile(file)
        setAvatarPreviewUrl(URL.createObjectURL(file))
    }

    const handleAvatarFile = async (file: File) => {
        try {
            setAvatarCropState({
                src: await readPersonaAvatarAsDataUrl(file),
                fileName: file.name
            })
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Avatar upload failed")
        }
    }

    const selectPersona = (persona: BuiltInPersona) => {
        setIsCreating(false)
        setSelectedPersonaId(persona.id)
        setSelectedStarter(persona.conversationStarters[0] ?? "")
    }

    const canCreate =
        createForm.name.trim().length > 0 &&
        createForm.shortName.trim().length > 0 &&
        createForm.shortName.trim().length <= 10 &&
        createForm.description.trim().length > 0 &&
        createForm.instructions.trim().length > 0 &&
        createForm.starters.every((starter) => starter.trim().length > 0)

    const uploadAvatar = async (file: File) => {
        const jwt = await resolveJwtToken(token)
        if (!jwt) throw new Error("Authentication token unavailable")

        const compressed = await compressPersonaAvatar(file)
        const formData = new FormData()
        formData.append("file", compressed)
        formData.append("fileName", compressed.name)

        const response = await fetch(`${browserEnv("VITE_CONVEX_API_URL")}/upload/persona-avatar`, {
            method: "POST",
            headers: { Authorization: `Bearer ${jwt}` },
            body: formData
        })

        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Avatar upload failed")
        return payload as PersonaAvatarUpload
    }

    const finishOnboarding = async (
        handoff: { source: "builtin" | "user"; id: string; defaultModelId: string },
        starter: string
    ) => {
        setPersonaOnboardingHandoff(handoff)
        if (starter) localStorage.setItem("user-input", starter)
        // Persona onboarding replaces the generic dialog for this acquisition path.
        // Complete it before entering chat so the regular onboarding cannot flash.
        await completeOnboarding({})
        void navigate({ to: "/" })
    }

    const handleBegin = async () => {
        if (!selectedPersona || isSaving) return
        setIsSaving(true)
        try {
            await finishOnboarding(
                {
                    source: "builtin",
                    id: selectedPersona.id,
                    defaultModelId: selectedPersona.defaultModelId
                },
                selectedStarter
            )
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to start persona chat")
            setIsSaving(false)
        }
    }

    const handleCreate = async () => {
        if (!canCreate || !selectedPersona || isSaving) return
        setIsSaving(true)
        try {
            const uploadedAvatar = avatarFile ? await uploadAvatar(avatarFile) : null
            const personaId = await createPersona({
                name: createForm.name.trim(),
                shortName: createForm.shortName.trim(),
                description: createForm.description.trim(),
                instructions: createForm.instructions.trim(),
                conversationStarters: createForm.starters.map((starter) => starter.trim()),
                defaultModelId: selectedPersona.defaultModelId,
                avatar: uploadedAvatar
                    ? {
                          key: uploadedAvatar.key,
                          mimeType: uploadedAvatar.fileType,
                          sizeBytes: uploadedAvatar.fileSize
                      }
                    : null,
                knowledgeDocs: []
            })
            await finishOnboarding(
                {
                    source: "user",
                    id: personaId,
                    defaultModelId: selectedPersona.defaultModelId
                },
                createForm.starters[0]?.trim() ?? ""
            )
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create persona")
            setIsSaving(false)
        }
    }

    if (isPending) {
        return <SplashScreen isExiting={false} label="Loading personas" />
    }

    if (!session?.user) {
        return (
            <Navigate
                to="/auth/$pathname"
                params={{ pathname: "login" }}
                search={{ redirect: PERSONA_ONBOARDING_PATH }}
                replace
            />
        )
    }

    if (!selectedPersona) return null

    return (
        <MotionConfig transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            <main className="relative h-svh overflow-y-auto overflow-x-hidden bg-background text-foreground">
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed inset-0 opacity-[0.035]"
                    style={{ backgroundImage: "url(/noise.png)", backgroundRepeat: "repeat" }}
                />

                <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
                    <Link to="/" className="flex items-center gap-3">
                        <ArrowLeft className="size-4 text-muted-foreground" />
                        <LogoMark className="h-auto w-28" />
                    </Link>
                    <ThemeSwitcher />
                </header>

                <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pt-8 pb-36 sm:px-8 sm:pt-12 lg:pb-16">
                    <section className="w-full" style={accentStyle}>
                        <div className="mb-8 sm:mb-10">
                            <h1 className="max-w-3xl font-semibold text-3xl tracking-tight sm:text-5xl">
                                <span className="sm:hidden">Pick a Persona.</span>
                                <span className="hidden sm:inline">
                                    Choose where your first story begins.
                                </span>
                            </h1>
                            <p className="mt-3 hidden text-muted-foreground sm:block">
                                Pick a character and an opening. You can change either later.
                            </p>
                        </div>

                        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_28rem] xl:gap-20">
                            <div className="grid min-w-0 gap-4 sm:grid-cols-[4.5rem_minmax(0,40rem)]">
                                <div className="order-2 grid grid-cols-3 gap-2 sm:order-1 sm:flex sm:flex-col sm:overflow-visible sm:pb-0">
                                    {personas.map((persona) => {
                                        const isSelected =
                                            !isCreating && persona.id === selectedPersona.id
                                        return (
                                            <button
                                                type="button"
                                                key={persona.id}
                                                aria-label={`Choose ${persona.shortName}`}
                                                aria-pressed={isSelected}
                                                onClick={() => selectPersona(persona)}
                                                style={
                                                    isSelected
                                                        ? { borderColor: "var(--persona-accent)" }
                                                        : undefined
                                                }
                                                className={cn(
                                                    "relative aspect-square w-full shrink-0 overflow-hidden rounded-[var(--radius-md)] border-2 bg-muted transition-all",
                                                    isSelected
                                                        ? "opacity-100"
                                                        : "border-border opacity-65 hover:border-primary/60 hover:opacity-100"
                                                )}
                                            >
                                                <img
                                                    src={persona.avatarPath}
                                                    alt=""
                                                    className="size-full object-contain"
                                                />
                                                {isSelected ? (
                                                    <span
                                                        className="absolute right-1 bottom-1 flex size-4 items-center justify-center rounded-[var(--radius-xl)] text-primary-foreground"
                                                        style={{
                                                            backgroundColor: "var(--persona-accent)"
                                                        }}
                                                    >
                                                        <Check className="size-2.5" />
                                                    </span>
                                                ) : null}
                                            </button>
                                        )
                                    })}
                                    <button
                                        type="button"
                                        aria-label="Create your own persona"
                                        aria-pressed={isCreating}
                                        onClick={() => setIsCreating(true)}
                                        style={
                                            isCreating
                                                ? { borderColor: "var(--persona-accent)" }
                                                : undefined
                                        }
                                        className={cn(
                                            "flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border-2 border-dashed transition-colors",
                                            isCreating
                                                ? "bg-primary/10 text-primary"
                                                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                                        )}
                                    >
                                        <Plus className="size-5" />
                                    </button>
                                </div>

                                <div className="order-1 hidden aspect-square w-full overflow-hidden rounded-[var(--radius-lg)] bg-muted sm:order-2 sm:block">
                                    <AnimatePresence mode="wait" initial={false}>
                                        {isCreating ? (
                                            <motion.div
                                                key="create"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="size-full"
                                            >
                                                <AvatarUploadArea
                                                    id="persona-avatar-desktop"
                                                    previewUrl={avatarPreviewUrl}
                                                    onFile={handleAvatarFile}
                                                    className="size-full"
                                                />
                                            </motion.div>
                                        ) : (
                                            <motion.img
                                                key={selectedPersona.id}
                                                src={selectedPersona.avatarPath}
                                                alt={selectedPersona.shortName}
                                                initial={{ opacity: 0, scale: 1.015 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="size-full object-contain"
                                            />
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            <div className="flex min-h-[40rem] flex-col pt-2">
                                <AnimatePresence mode="wait" initial={false}>
                                    {isCreating ? (
                                        <motion.div
                                            key="create-form"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            className="space-y-5"
                                        >
                                            <div
                                                aria-hidden="true"
                                                className="h-1 w-12 rounded-[var(--radius-xl)]"
                                                style={{
                                                    backgroundColor: "var(--persona-accent)"
                                                }}
                                            />
                                            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                                                <div className="space-y-2">
                                                    <Label htmlFor="new-persona-name">Name</Label>
                                                    <div className="flex items-center gap-3">
                                                        <Input
                                                            id="new-persona-name"
                                                            value={createForm.name}
                                                            onChange={(event) =>
                                                                setCreateForm((form) => ({
                                                                    ...form,
                                                                    name: event.target.value
                                                                }))
                                                            }
                                                            placeholder="A mysterious stranger"
                                                            className="min-w-0 flex-1"
                                                        />
                                                        <MobileAvatarUploadButton
                                                            id="persona-avatar-mobile"
                                                            previewUrl={avatarPreviewUrl}
                                                            onFile={handleAvatarFile}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="new-persona-short-name">
                                                        Short name
                                                    </Label>
                                                    <Input
                                                        id="new-persona-short-name"
                                                        value={createForm.shortName}
                                                        maxLength={10}
                                                        onChange={(event) =>
                                                            setCreateForm((form) => ({
                                                                ...form,
                                                                shortName: event.target.value
                                                            }))
                                                        }
                                                        placeholder="Stranger"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-persona-description">
                                                    Description
                                                </Label>
                                                <Textarea
                                                    id="new-persona-description"
                                                    value={createForm.description}
                                                    rows={3}
                                                    onChange={(event) =>
                                                        setCreateForm((form) => ({
                                                            ...form,
                                                            description: event.target.value
                                                        }))
                                                    }
                                                    placeholder="Who are they, and what makes them interesting?"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-persona-instructions">
                                                    Character instructions
                                                </Label>
                                                <Textarea
                                                    id="new-persona-instructions"
                                                    value={createForm.instructions}
                                                    rows={6}
                                                    onChange={(event) =>
                                                        setCreateForm((form) => ({
                                                            ...form,
                                                            instructions: event.target.value
                                                        }))
                                                    }
                                                    placeholder="Describe their voice, behavior, world, and boundaries."
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Conversation starters</Label>
                                                {createForm.starters.map((starter, index) => (
                                                    <Input
                                                        key={index}
                                                        value={starter}
                                                        onChange={(event) =>
                                                            setCreateForm((form) => ({
                                                                ...form,
                                                                starters: form.starters.map(
                                                                    (value, starterIndex) =>
                                                                        starterIndex === index
                                                                            ? event.target.value
                                                                            : value
                                                                ) as [string, string]
                                                            }))
                                                        }
                                                        placeholder={
                                                            index === 0
                                                                ? "Where does the story begin?"
                                                                : "Give them another way in."
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key={selectedPersona.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                        >
                                            <h2 className="font-semibold text-4xl tracking-tight">
                                                {selectedPersona.shortName}
                                            </h2>
                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {(PERSONA_METADATA[selectedPersona.id] ?? []).map(
                                                    (label) => (
                                                        <span
                                                            key={label}
                                                            className="rounded-[var(--radius-xl)] border px-2.5 py-1 font-medium text-xs"
                                                            style={{
                                                                color: "var(--foreground)",
                                                                backgroundColor:
                                                                    "color-mix(in oklab, var(--persona-accent) 26%, var(--background))",
                                                                borderColor:
                                                                    "color-mix(in oklab, var(--persona-accent) 38%, var(--border))"
                                                            }}
                                                        >
                                                            {label}
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                            <p className="mt-3 min-h-28 text-muted-foreground text-sm leading-relaxed">
                                                {selectedPersona.description}
                                            </p>
                                            <div className="mt-5">
                                                <p className="flex items-center gap-2 font-medium text-sm">
                                                    <MessageCircle
                                                        className="size-4"
                                                        style={{ color: "var(--persona-accent)" }}
                                                    />
                                                    Choose your opening
                                                </p>
                                                <div className="mt-3 border-border border-y">
                                                    {selectedPersona.conversationStarters.map(
                                                        (starter) => {
                                                            const selected =
                                                                starter === selectedStarter
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    key={starter}
                                                                    onClick={() =>
                                                                        setSelectedStarter(starter)
                                                                    }
                                                                    className={cn(
                                                                        "relative w-full border-border border-b py-3.5 pr-3 pl-7 text-left text-sm leading-relaxed transition-colors last:border-b-0",
                                                                        selected
                                                                            ? "text-foreground"
                                                                            : "text-muted-foreground hover:text-foreground"
                                                                    )}
                                                                >
                                                                    <span
                                                                        className={cn(
                                                                            "absolute top-5 left-1 size-2 rounded-[var(--radius-xl)] border",
                                                                            selected
                                                                                ? "border-transparent"
                                                                                : "border-muted-foreground/50"
                                                                        )}
                                                                        style={
                                                                            selected
                                                                                ? {
                                                                                      backgroundColor:
                                                                                          "var(--persona-accent)"
                                                                                  }
                                                                                : undefined
                                                                        }
                                                                    />
                                                                    “{starter}”
                                                                </button>
                                                            )
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="fixed inset-x-0 bottom-0 z-30 border-border border-t bg-background/95 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:px-8 lg:static lg:z-auto lg:mt-auto lg:border-0 lg:bg-transparent lg:px-0 lg:pt-8 lg:pb-0 lg:backdrop-blur-none">
                                    <Button
                                        className="mx-auto h-11 w-full max-w-md gap-2 lg:max-w-none"
                                        disabled={isSaving || (isCreating && !canCreate)}
                                        onClick={() =>
                                            isCreating ? void handleCreate() : handleBegin()
                                        }
                                    >
                                        {isSaving ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : null}
                                        {isCreating && !isSaving ? (
                                            <Save className="size-4" />
                                        ) : null}
                                        {isCreating
                                            ? "Create persona"
                                            : `Begin with ${selectedPersona.shortName}`}
                                        {!isCreating && <ArrowRight className="size-4" />}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
                <PersonaAvatarCropper
                    cropState={avatarCropState}
                    open={avatarCropState !== null}
                    onOpenChange={(open) => {
                        if (!open && !isCroppingAvatar) setAvatarCropState(null)
                    }}
                    isSaving={isCroppingAvatar}
                    onConfirm={async (croppedAreaPixels) => {
                        if (!avatarCropState) return
                        setIsCroppingAvatar(true)
                        try {
                            const croppedFile = await cropPersonaAvatarToSquare({
                                ...avatarCropState,
                                croppedAreaPixels
                            })
                            setAvatarPreview(croppedFile)
                            setAvatarCropState(null)
                        } catch (error) {
                            toast.error(
                                error instanceof Error ? error.message : "Avatar crop failed"
                            )
                        } finally {
                            setIsCroppingAvatar(false)
                        }
                    }}
                />
            </main>
        </MotionConfig>
    )
}
