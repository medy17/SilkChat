import { PersonaAvatar } from "@/components/persona-avatar"
import { PromptInputAction } from "@/components/prompt-kit/prompt-input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useSession } from "@/hooks/auth-hooks"
import { useIsMobile } from "@/hooks/use-mobile"
import { useChatStore } from "@/lib/chat-store"
import { useDiskCachedQuery } from "@/lib/convex-cached-query"
import { DefaultSettings } from "@/lib/default-user-settings"
import { useModelStore } from "@/lib/model-store"
import { useAvailableModels } from "@/lib/models-providers-shared"
import { useConvexAuth } from "@convex-dev/react-query"
import { useQuery } from "convex/react"
import { Sparkles } from "lucide-react"
import { useMemo } from "react"
import { toast } from "sonner"

type PersonaOption = {
    source: "builtin" | "user"
    id: string
    name: string
    shortName: string
    description: string
    conversationStarters: string[]
    defaultModelId: string
    avatarKind?: "builtin" | "r2"
    avatarValue?: string
    avatarMimeType?: string
}

const getSelectValue = (source: "default" | "builtin" | "user", id?: string) =>
    source === "default" ? "default" : `${source}:${id}`

export function PersonaSelector({ threadId }: { threadId?: string }) {
    const session = useSession()
    const auth = useConvexAuth()
    const isMobile = useIsMobile()
    const { selectedModel, setSelectedModel } = useModelStore()
    const { selectedPersona, setSelectedPersona } = useChatStore()
    const pickerOptions = useQuery(
        api.personas.listPersonaPickerOptions,
        session.user?.id && !auth.isLoading ? {} : "skip"
    )
    const threadSnapshot = useQuery(
        api.personas.getThreadPersonaSnapshot,
        threadId ? { threadId: threadId as Id<"threads"> } : "skip"
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
    const { availableModels } = useAvailableModels(
        "error" in userSettings ? undefined : userSettings
    )
    const availableModelIds = useMemo(
        () => new Set(availableModels.map((model) => model.id)),
        [availableModels]
    )

    const allOptions = useMemo<PersonaOption[]>(() => {
        if (!pickerOptions) return []
        return [...pickerOptions.builtIns, ...pickerOptions.userPersonas]
    }, [pickerOptions])

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

    if (threadId && threadSnapshot) {
        return (
            <PromptInputAction tooltip="Thread persona">
                <Badge
                    variant="secondary"
                    className="flex h-8 items-center gap-2 rounded-md bg-secondary/70 px-2"
                >
                    <PersonaAvatar
                        name={threadSnapshot.name}
                        avatarKind={threadSnapshot.avatarKind}
                        avatarValue={threadSnapshot.avatarValue}
                        className="size-5"
                    />
                    <span className="max-w-[140px] truncate">
                        {isMobile
                            ? (threadSnapshot.shortName ?? threadSnapshot.name)
                            : threadSnapshot.name}
                    </span>
                </Badge>
            </PromptInputAction>
        )
    }

    return (
        <PromptInputAction tooltip="Select persona">
            <Select
                value={selectedValue}
                onValueChange={(value) => {
                    if (value === "default") {
                        setSelectedPersona({ source: "default" })
                        return
                    }

                    const [source, id] = value.split(":") as ["builtin" | "user", string]
                    const option = allOptions.find(
                        (candidate) => candidate.source === source && candidate.id === id
                    )

                    if (!option) {
                        setSelectedPersona({ source: "default" })
                        return
                    }

                    setSelectedPersona({ source, id })

                    if (availableModelIds.has(option.defaultModelId)) {
                        if (selectedModel !== option.defaultModelId) {
                            setSelectedModel(option.defaultModelId)
                        }
                    } else {
                        toast.warning(
                            `${option.name} prefers ${option.defaultModelId}, but it is not currently available.`
                        )
                    }
                }}
            >
                <SelectTrigger className="!h-8 !px-1.5 min-[390px]:!px-2 min-w-0 gap-0.5 border bg-secondary/70 text-xs backdrop-blur-lg hover:bg-secondary/80 sm:min-w-[220px] sm:text-sm min-[390px]:gap-2">
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
                        <span className="hidden truncate min-[390px]:block">{selectedLabel}</span>
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    {pickerOptions?.builtIns.map((persona) => (
                        <SelectItem
                            key={`builtin:${persona.id}`}
                            value={getSelectValue("builtin", persona.id)}
                        >
                            {persona.name}
                        </SelectItem>
                    ))}
                    {pickerOptions?.userPersonas.map((persona) => (
                        <SelectItem
                            key={`user:${persona.id}`}
                            value={getSelectValue("user", persona.id)}
                        >
                            {persona.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </PromptInputAction>
    )
}
