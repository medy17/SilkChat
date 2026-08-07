import { PersonaAvatar } from "@/components/persona-avatar"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useSession } from "@/hooks/auth-hooks"
import { useIsMobile } from "@/hooks/use-mobile"
import {
    notifyModelReplacement,
    resolveAvailableModelReplacement
} from "@/hooks/use-model-lifecycle-migration"
import { useChatStore } from "@/lib/chat-store"
import { useDiskCachedQuery } from "@/lib/convex-cached-query"
import { DefaultSettings } from "@/lib/default-user-settings"
import { useModelStore } from "@/lib/model-store"
import { useAvailableModels } from "@/lib/models-providers-shared"
import { clearPersonaOnboardingHandoff } from "@/lib/persona-onboarding"
import { useSharedModels } from "@/lib/shared-models"
import { useConvexAuth } from "@convex-dev/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import { Check, ChevronDown, Plus, Sparkles } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { nanoid } from "nanoid"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

type PersonaOption = {
    source: "builtin" | "user"
    id: string
    name: string
    shortName: string
    description: string
    conversationStarters: string[]
    openings?: Array<{
        id: string
        text: string
        suggestedReplies: string[]
    }>
    defaultModelId: string
    avatarKind?: "builtin" | "r2"
    avatarValue?: string
    avatarMimeType?: string
}

const getSelectValue = (source: "default" | "builtin" | "user", id?: string) =>
    source === "default" ? "default" : `${source}:${id}`

const personaChromeTransition = {
    duration: 0.2,
    ease: [0.16, 1, 0.3, 1]
} as const
const PERSONA_POPOVER_CONTENT_CLASS =
    "z-[80] max-h-[min(20rem,var(--radix-popover-content-available-height,calc(100dvh-1rem)))] w-[min(14.5rem,calc(100vw-1rem))] min-w-[min(var(--radix-popover-trigger-width),14.5rem,calc(100vw-1rem))] max-w-[min(14.5rem,calc(100vw-1rem))] overflow-y-auto overscroll-contain rounded-[var(--radius-lg)] border-border/70 bg-popover p-1 shadow-lg"
const PERSONA_MENU_ITEM_CLASS =
    "flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
const PERSONA_PICKER_REVALIDATION_DELAY_MS = 240

function PersonaSelectItem({ persona }: { persona: PersonaOption }) {
    return (
        <div className="flex min-w-0 flex-1 items-center gap-2">
            <PersonaAvatar
                name={persona.name}
                avatarKind={persona.avatarKind}
                avatarValue={persona.avatarValue}
                className="size-5"
            />
            <span className="truncate">{persona.name}</span>
        </div>
    )
}

export function PersonaSelector({ threadId }: { threadId?: string }) {
    const session = useSession()
    const auth = useConvexAuth()
    const navigate = useNavigate()
    const isMobile = useIsMobile()
    const [isPickerOpen, setIsPickerOpen] = useState(false)
    const [canRevalidatePickerOptions, setCanRevalidatePickerOptions] = useState(true)
    const { selectedModel, setSelectedModel } = useModelStore()
    const { selectedPersona, setSelectedPersona, setPendingPersonaOpening } = useChatStore()
    const thread = useQuery(
        api.threads.getThread,
        threadId && session.user?.id && !auth.isLoading
            ? { threadId: threadId as Id<"threads"> }
            : "skip"
    )
    useEffect(() => {
        if (!isPickerOpen) {
            setCanRevalidatePickerOptions(true)
            return
        }

        setCanRevalidatePickerOptions(false)
        const timeoutId = window.setTimeout(() => {
            setCanRevalidatePickerOptions(true)
        }, PERSONA_PICKER_REVALIDATION_DELAY_MS)

        return () => window.clearTimeout(timeoutId)
    }, [isPickerOpen])

    const pickerOptions = useDiskCachedQuery(
        api.personas.listPersonaPickerOptions,
        {
            key: "persona-picker-options",
            default: { builtIns: [], userPersonas: [] },
            forceCache: true
        },
        session.user?.id && !auth.isLoading && canRevalidatePickerOptions ? {} : "skip"
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
    const resolvedPickerOptions = "error" in pickerOptions ? null : pickerOptions
    const { availableModels } = useAvailableModels(
        "error" in userSettings ? undefined : userSettings
    )
    const { models: sharedModels } = useSharedModels()
    const availableModelIds = useMemo(
        () => new Set(availableModels.map((model) => model.id)),
        [availableModels]
    )

    const allOptions = useMemo<PersonaOption[]>(() => {
        if (!resolvedPickerOptions) return []
        return [...resolvedPickerOptions.builtIns, ...resolvedPickerOptions.userPersonas]
    }, [resolvedPickerOptions])

    const selectedValue = getSelectValue(selectedPersona.source, selectedPersona.id)

    const selectedOption = useMemo(
        () =>
            selectedPersona.source === "default"
                ? null
                : (allOptions.find(
                      (option) =>
                          option.source === selectedPersona.source &&
                          option.id === selectedPersona.id
                  ) ?? null),
        [allOptions, selectedPersona]
    )
    const selectedLabel = selectedOption
        ? isMobile
            ? selectedOption.shortName
            : selectedOption.name
        : "Default"

    const lockedPersonaName =
        threadId &&
        (thread?.personaName ??
            (thread === undefined && selectedOption
                ? isMobile
                    ? selectedOption.shortName
                    : selectedOption.name
                : null))
    const lockedAvatarKind =
        threadId &&
        (thread?.personaAvatarKind ??
            (thread === undefined && selectedOption ? selectedOption.avatarKind : undefined))
    const lockedAvatarValue =
        threadId &&
        (thread?.personaAvatarValue ??
            (thread === undefined && selectedOption ? selectedOption.avatarValue : undefined))

    const applyPersonaSelection = (option: PersonaOption) => {
        // Manual choice wins over any pending onboarding handoff.
        clearPersonaOnboardingHandoff()
        setSelectedPersona({ source: option.source, id: option.id })
        const opening = option.openings?.[0]
        setPendingPersonaOpening(
            opening
                ? {
                      source: option.source,
                      personaId: option.id,
                      openingId: opening.id,
                      messageId: nanoid(),
                      text: opening.text,
                      suggestedReplies: opening.suggestedReplies
                  }
                : undefined
        )

        const replacement = resolveAvailableModelReplacement({
            modelId: option.defaultModelId,
            sharedModels,
            availableModels
        })
        const targetModelId = availableModelIds.has(option.defaultModelId)
            ? option.defaultModelId
            : replacement.replacementId

        if (targetModelId && availableModelIds.has(targetModelId)) {
            if (selectedModel !== targetModelId) {
                setSelectedModel(targetModelId)
            }
            if (
                targetModelId !== option.defaultModelId &&
                replacement.originalModel &&
                replacement.replacement
            ) {
                notifyModelReplacement(replacement.originalModel, replacement.replacement)
            }
        } else {
            toast.warning(
                `${option.name} prefers ${option.defaultModelId}, but it is not currently available.`
            )
        }
    }

    return (
        <motion.div layout className="shrink-0 overflow-hidden">
            <AnimatePresence initial={false} mode="popLayout">
                {!threadId ? (
                    <motion.div
                        key="persona-picker"
                        layout
                        initial={{ opacity: 0, x: -12, scale: 0.96 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -12, scale: 0.96 }}
                        transition={personaChromeTransition}
                    >
                        <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className="flex h-8 @3xl:min-w-[13.75rem] min-w-0 items-center justify-between gap-0.5 rounded-[var(--radius-md)] border bg-secondary/70 px-1.5 @3xl:text-sm text-xs backdrop-blur-lg transition-colors hover:bg-secondary/80 min-[390px]:gap-2 min-[390px]:px-2"
                                    aria-label="Select persona"
                                    title="Select persona"
                                >
                                    <div className="flex min-w-0 items-center gap-2">
                                        {selectedOption ? (
                                            <PersonaAvatar
                                                name={selectedOption.name}
                                                avatarKind={selectedOption.avatarKind}
                                                avatarValue={selectedOption.avatarValue}
                                                className="size-5"
                                            />
                                        ) : (
                                            <Sparkles className="size-4 shrink-0" />
                                        )}
                                        <span className="hidden truncate min-[390px]:block">
                                            {selectedLabel}
                                        </span>
                                    </div>
                                    <ChevronDown className="size-4 shrink-0 opacity-50" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                align="start"
                                side="top"
                                sideOffset={6}
                                collisionPadding={8}
                                className={PERSONA_POPOVER_CONTENT_CLASS}
                            >
                                <button
                                    type="button"
                                    className={`${PERSONA_MENU_ITEM_CLASS} font-medium text-primary`}
                                    onClick={() => {
                                        setIsPickerOpen(false)
                                        void navigate({ to: "/settings/personas" })
                                    }}
                                >
                                    <Plus className="size-4 shrink-0" />
                                    Create New Persona
                                </button>
                                <div className="-mx-1 my-1 h-px bg-border" />
                                <button
                                    type="button"
                                    className={PERSONA_MENU_ITEM_CLASS}
                                    onClick={() => {
                                        clearPersonaOnboardingHandoff()
                                        setSelectedPersona({ source: "default" })
                                        setPendingPersonaOpening(undefined)
                                        setIsPickerOpen(false)
                                    }}
                                >
                                    <Sparkles className="size-4 shrink-0" />
                                    <span className="min-w-0 flex-1 truncate">Default</span>
                                    {selectedPersona.source === "default" && (
                                        <Check className="size-4 shrink-0" />
                                    )}
                                </button>
                                {resolvedPickerOptions?.builtIns.map((persona) => {
                                    const isSelected =
                                        selectedValue === getSelectValue("builtin", persona.id)

                                    return (
                                        <button
                                            key={`builtin:${persona.id}`}
                                            type="button"
                                            className={PERSONA_MENU_ITEM_CLASS}
                                            onClick={() => {
                                                applyPersonaSelection(persona)
                                                setIsPickerOpen(false)
                                            }}
                                        >
                                            <PersonaSelectItem persona={persona} />
                                            {isSelected && <Check className="size-4 shrink-0" />}
                                        </button>
                                    )
                                })}
                                {resolvedPickerOptions?.userPersonas.map((persona) => {
                                    const isSelected =
                                        selectedValue === getSelectValue("user", persona.id)

                                    return (
                                        <button
                                            key={`user:${persona.id}`}
                                            type="button"
                                            className={PERSONA_MENU_ITEM_CLASS}
                                            onClick={() => {
                                                applyPersonaSelection(persona)
                                                setIsPickerOpen(false)
                                            }}
                                        >
                                            <PersonaSelectItem persona={persona} />
                                            {isSelected && <Check className="size-4 shrink-0" />}
                                        </button>
                                    )
                                })}
                            </PopoverContent>
                        </Popover>
                    </motion.div>
                ) : null}

                {lockedPersonaName ? (
                    <motion.div
                        key={`thread-persona:${lockedPersonaName}`}
                        layout
                        initial={{ opacity: 0, x: -12, scale: 0.96 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -12, scale: 0.96 }}
                        transition={personaChromeTransition}
                    >
                        <Badge
                            variant="secondary"
                            className="flex h-8 items-center gap-2 rounded-[var(--radius-md)] bg-secondary/70 px-2"
                            title="Thread persona"
                        >
                            {lockedAvatarKind && lockedAvatarValue ? (
                                <PersonaAvatar
                                    name={lockedPersonaName}
                                    avatarKind={lockedAvatarKind}
                                    avatarValue={lockedAvatarValue}
                                    className="size-5"
                                />
                            ) : (
                                <Sparkles className="size-4 shrink-0" />
                            )}
                            <span className="max-w-[8.75rem] truncate">{lockedPersonaName}</span>
                        </Badge>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </motion.div>
    )
}
