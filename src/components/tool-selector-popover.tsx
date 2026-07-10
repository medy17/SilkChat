import { MCPIcon, SupermemoryIcon } from "@/components/brand-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import {
    ResponsivePopover,
    ResponsivePopoverContent,
    ResponsivePopoverTrigger
} from "@/components/ui/responsive-popover"
import { Switch } from "@/components/ui/switch"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { useIsMobile } from "@/hooks/use-mobile"
import {
    IMAGE_RESOLUTION_OPTIONS,
    type ImageDefaultResolution,
    MAX_DEFAULT_VARIANTS
} from "@/lib/image-generation-defaults"
import { useModelStore } from "@/lib/model-store"
import { SEARCH_PROVIDERS } from "@/lib/models-providers-shared"
import type { AbilityId } from "@/lib/tool-abilities"
import {
    DEFAULT_TOOL_CALL_LIMIT_PER_TURN,
    MAX_TOOL_CALL_LIMIT_PER_TURN,
    MIN_TOOL_CALL_LIMIT_PER_TURN,
    clampToolCallLimitPerTurn
} from "@/lib/tool-call-limit"
import { cn } from "@/lib/utils"
import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query"
import { CircleHelp, ExternalLink, Globe, Image, Settings2 } from "lucide-react"
import { memo, useState } from "react"
import { toast } from "sonner"

type ToolSelectorPopoverProps = {
    threadId?: string
    enabledTools: AbilityId[]
    onEnabledToolsChange: (tools: AbilityId[]) => void
    modelSupportsFunctionCalling: boolean
    modelSupportsVision: boolean
    className?: string
    tone?: "default" | "on-primary"
}

type SearchProviderId = "firecrawl" | "brave" | "tavily" | "serper"

const getSearchProviderName = (providerId: string | undefined) =>
    SEARCH_PROVIDERS.find((provider) => provider.id === providerId)?.name ?? "Unknown"

function WebSearchInfoContent({
    selectedProviderName,
    configuredProvidersLabel,
    fundingLabel,
    available
}: {
    selectedProviderName: string
    configuredProvidersLabel: string
    fundingLabel: string
    available: boolean
}) {
    return (
        <div className="space-y-3 p-3 text-sm">
            <div>
                <div className="font-medium text-foreground">Web Search</div>
                <p className="mt-1 text-muted-foreground text-xs">
                    Web Search uses only the selected provider.
                </p>
            </div>

            <div className="space-y-1 text-xs">
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Selected provider</span>
                    <span className="font-medium text-foreground">{selectedProviderName}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium text-foreground">
                        {available ? fundingLabel : "Not configured"}
                    </span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Configured keys</span>
                    <span className="max-w-40 truncate text-right font-medium text-foreground">
                        {configuredProvidersLabel}
                    </span>
                </div>
            </div>

            {!available && (
                <a
                    href="/settings/ai-setup?tab=providers"
                    className="inline-flex items-center gap-1 text-primary text-xs underline"
                >
                    Configure provider key
                    <ExternalLink className="size-3" />
                </a>
            )}
        </div>
    )
}

function WebSearchInfoButton({
    isMobile,
    selectedProviderName,
    configuredProvidersLabel,
    fundingLabel,
    available
}: {
    isMobile: boolean
    selectedProviderName: string
    configuredProvidersLabel: string
    fundingLabel: string
    available: boolean
}) {
    const [open, setOpen] = useState(false)
    const trigger = (
        <button
            type="button"
            aria-label="Show Web Search configuration"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onPointerDown={(event) => {
                event.stopPropagation()
            }}
            onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                if (isMobile) setOpen(true)
            }}
        >
            <CircleHelp className="size-3.5" />
        </button>
    )

    const content = (
        <WebSearchInfoContent
            selectedProviderName={selectedProviderName}
            configuredProvidersLabel={configuredProvidersLabel}
            fundingLabel={fundingLabel}
            available={available}
        />
    )

    if (isMobile) {
        return (
            <ResponsivePopover open={open} onOpenChange={setOpen} nested>
                <ResponsivePopoverTrigger asChild>{trigger}</ResponsivePopoverTrigger>
                <ResponsivePopoverContent
                    className="z-[91] w-[min(24rem,calc(100vw-1rem))] p-0"
                    overlayClassName="z-[90]"
                    title="Web Search"
                    description="Selected provider and configured keys"
                >
                    {content}
                </ResponsivePopoverContent>
            </ResponsivePopover>
        )
    }

    return (
        <HoverCard openDelay={120} closeDelay={120}>
            <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
            <HoverCardContent align="start" side="right" sideOffset={12} className="w-80 p-0">
                {content}
            </HoverCardContent>
        </HoverCard>
    )
}

function ToolCallLimitInfoButton({ isMobile }: { isMobile: boolean }) {
    const content = (
        <div className="p-3 text-sm">
            <div className="font-medium text-foreground">Tool Calls</div>
            <p className="mt-1 text-muted-foreground text-xs">
                Global per-turn limit across all tools.
            </p>
        </div>
    )

    if (isMobile) {
        return null
    }

    return (
        <HoverCard openDelay={120} closeDelay={120}>
            <HoverCardTrigger asChild>
                <button
                    type="button"
                    aria-label="Show tool call limit details"
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    onPointerDown={(event) => {
                        event.stopPropagation()
                    }}
                    onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                    }}
                >
                    <CircleHelp className="size-3.5" />
                </button>
            </HoverCardTrigger>
            <HoverCardContent align="start" side="right" sideOffset={12} className="w-64 p-0">
                {content}
            </HoverCardContent>
        </HoverCard>
    )
}

function SilkScreenInfoButton({
    isMobile,
    available
}: {
    isMobile: boolean
    available: boolean
}) {
    const [open, setOpen] = useState(false)
    const content = (
        <div className="space-y-3 p-3 text-sm">
            <div>
                <div className="font-medium text-foreground">SilkScreen</div>
                <p className="mt-1 text-muted-foreground text-xs">
                    Prepares an image job card for confirmation. Included usage is only consumed
                    after you tap Generate.
                </p>
            </div>
            <div className="space-y-1 text-xs">
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Tool call</span>
                    <span className="font-medium text-foreground">Free</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium text-foreground">
                        {available ? "Available" : "Needs vision + tools"}
                    </span>
                </div>
            </div>
        </div>
    )
    const trigger = (
        <button
            type="button"
            aria-label="Show SilkScreen image preparation details"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onPointerDown={(event) => {
                event.stopPropagation()
            }}
            onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                if (isMobile) setOpen(true)
            }}
        >
            <CircleHelp className="size-3.5" />
        </button>
    )

    if (isMobile) {
        return (
            <ResponsivePopover open={open} onOpenChange={setOpen} nested>
                <ResponsivePopoverTrigger asChild>{trigger}</ResponsivePopoverTrigger>
                <ResponsivePopoverContent
                    className="z-[91] w-[min(24rem,calc(100vw-1rem))] p-0"
                    overlayClassName="z-[90]"
                    title="SilkScreen"
                    description="Image preparation details"
                >
                    {content}
                </ResponsivePopoverContent>
            </ResponsivePopover>
        )
    }

    return (
        <HoverCard openDelay={120} closeDelay={120}>
            <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
            <HoverCardContent align="start" side="right" sideOffset={12} className="w-80 p-0">
                {content}
            </HoverCardContent>
        </HoverCard>
    )
}

export const ToolSelectorPopover = memo(
    ({
        threadId,
        enabledTools,
        onEnabledToolsChange,
        modelSupportsFunctionCalling,
        modelSupportsVision,
        className,
        tone = "default"
    }: ToolSelectorPopoverProps) => {
        const session = useSession()
        const isMobile = useIsMobile()
        const [open, setOpen] = useState(false)
        const { setMcpOverride, setDefaultMcpOverride, mcpOverrides, defaultMcpOverrides } =
            useModelStore()

        const userSettings = useConvexQuery(
            api.settings.getUserSettings,
            session.user?.id ? {} : "skip"
        )
        const updateSettings = useConvexMutation(api.settings.updateUserSettingsPartial)
        const toolAvailability = useConvexQuery(
            api.settings.getToolAvailability,
            session.user?.id ? {} : "skip"
        )

        const activeVariant = tone === "on-primary" ? "ghost" : "default"

        const getButtonStateClassName = (isActive: boolean) => {
            if (tone === "on-primary") {
                return isActive
                    ? "border border-primary-foreground/20 bg-primary-foreground text-primary hover:bg-primary-foreground/90 hover:text-primary"
                    : "border border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
            }

            if (!isActive) {
                return "bg-secondary/70 backdrop-blur-lg hover:bg-secondary/80"
            }

            return ""
        }

        const webSearchEnabled = enabledTools.includes("web_search")
        const silkScreenAvailable = modelSupportsFunctionCalling && modelSupportsVision
        const webSearchAvailable = Boolean(toolAvailability?.web_search.enabled)
        const supermemoryAvailable = Boolean(toolAvailability?.supermemory.enabled)
        const webSearchDisabled = !modelSupportsFunctionCalling || !webSearchAvailable
        const selectedSearchProvider = userSettings?.searchProvider as SearchProviderId | undefined
        const selectedSearchProviderName = getSearchProviderName(selectedSearchProvider)
        const configuredSearchProviders =
            userSettings?.generalProviders === undefined
                ? []
                : SEARCH_PROVIDERS.filter((provider) => {
                      const config =
                          userSettings.generalProviders?.[provider.id as SearchProviderId]
                      return config?.enabled === true && Boolean(config.encryptedKey)
                  }).map((provider) => provider.name)
        const configuredSearchProvidersLabel =
            configuredSearchProviders.length > 0 ? configuredSearchProviders.join(", ") : "None"
        const webSearchFundingLabel =
            toolAvailability?.web_search.fundingSource === "byok"
                ? "BYOK"
                : toolAvailability?.web_search.fundingSource === "deployment"
                  ? "server"
                  : "not configured"
        const imageDefaults = userSettings?.imageGenerationDefaults
        const defaultImageResolution: ImageDefaultResolution =
            (imageDefaults?.resolution as ImageDefaultResolution | undefined) ?? "1K"
        const defaultImageVariants = imageDefaults?.variants ?? 1
        const updateImageDefaults = async (partial: {
            resolution?: ImageDefaultResolution
            variants?: number
        }) => {
            try {
                await updateSettings({ imageGenerationDefaults: partial })
            } catch (error) {
                toast.error("Failed to update image defaults")
                console.error(error)
            }
        }
        const updateToolCallLimit = async (nextLimit: number, isInteractive: boolean) => {
            if (!isInteractive) {
                return
            }

            try {
                await updateSettings({
                    toolCallLimitPerTurn: nextLimit
                })
            } catch (error) {
                toast.error("Failed to update tool call limit")
                console.error(error)
            }
        }
        const webSearchButton = (
            <Button
                type="button"
                variant={webSearchEnabled ? activeVariant : "ghost"}
                disabled={webSearchDisabled}
                onClick={() => {
                    if (!webSearchDisabled) {
                        onEnabledToolsChange(
                            webSearchEnabled
                                ? enabledTools.filter((tool) => tool !== "web_search")
                                : [...enabledTools, "web_search"]
                        )
                    }
                }}
                className={cn(
                    "size-8 shrink-0",
                    getButtonStateClassName(webSearchEnabled),
                    webSearchDisabled && "cursor-not-allowed opacity-50",
                    className
                )}
            >
                <Globe className="size-4" />
            </Button>
        )

        if (!userSettings || !toolAvailability) return webSearchButton

        const mcpServers = (userSettings.mcpServers || []).filter(
            (server) => server.enabled !== false
        )
        const hasMcpServers = mcpServers.length > 0

        // Calculate effective MCP overrides directly to ensure re-renders
        const currentMcpOverrides = threadId
            ? { ...defaultMcpOverrides, ...(mcpOverrides[threadId] || {}) }
            : { ...defaultMcpOverrides }

        const handleWebSearchToggle = () => {
            if (webSearchDisabled) return

            onEnabledToolsChange(
                enabledTools.includes("web_search")
                    ? enabledTools.filter((tool) => tool !== "web_search")
                    : [...enabledTools, "web_search"]
            )
        }

        const handleSupermemoryToggle = () => {
            if (!supermemoryAvailable) return

            onEnabledToolsChange(
                enabledTools.includes("supermemory")
                    ? enabledTools.filter((tool) => tool !== "supermemory")
                    : [...enabledTools, "supermemory"]
            )
        }

        const handleMcpServerToggle = (serverName: string, enabled: boolean) => {
            if (threadId) {
                // Set thread-specific override
                setMcpOverride(threadId, serverName, enabled)
            } else {
                // Set default override for new chats
                setDefaultMcpOverride(serverName, enabled)
            }
        }

        const getActiveToolsCount = () => {
            let count = 0
            if (webSearchAvailable && enabledTools.includes("web_search")) count++
            if (supermemoryAvailable && enabledTools.includes("supermemory")) count++
            if (hasMcpServers) {
                // Count enabled MCP servers for this thread
                const enabledMcpCount = mcpServers.filter(
                    (server) => currentMcpOverrides[server.name] !== false // Default to enabled
                ).length
                if (enabledMcpCount > 0) count++
            }
            return count
        }

        const activeCount = getActiveToolsCount()
        const effectiveToolCallLimit = clampToolCallLimitPerTurn(
            userSettings.toolCallLimitPerTurn,
            { hasEnabledTools: activeCount > 0 }
        )

        return (
            <ResponsivePopover open={open} onOpenChange={setOpen}>
                <ResponsivePopoverTrigger asChild>
                    <Button
                        type="button"
                        variant={activeCount > 0 ? activeVariant : "ghost"}
                        disabled={!modelSupportsFunctionCalling}
                        className={cn(
                            "relative size-8 shrink-0",
                            getButtonStateClassName(activeCount > 0),
                            !modelSupportsFunctionCalling && "cursor-not-allowed opacity-50",
                            className
                        )}
                    >
                        <Settings2 className="size-4" />
                        {activeCount > 0 && (
                            <span className="-top-0.5 -right-1 absolute flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                                {activeCount}
                            </span>
                        )}
                    </Button>
                </ResponsivePopoverTrigger>
                <ResponsivePopoverContent
                    className="p-0 md:w-80"
                    align="start"
                    title="Tool Settings"
                    description="Configure available tools for your conversation"
                >
                    <Command className="rounded-none md:rounded-md">
                        {!isMobile && (
                            <CommandInput placeholder="Search tools..." className="h-8" />
                        )}
                        <CommandList>
                            <CommandEmpty>No tools found.</CommandEmpty>
                            <div>
                                <CommandGroup heading="Tools">
                                    <CommandItem className="flex items-center justify-between p-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Globe className="h-4 w-4 shrink-0" />
                                            <span className="text-sm">Web Search</span>
                                            <WebSearchInfoButton
                                                isMobile={isMobile}
                                                selectedProviderName={selectedSearchProviderName}
                                                configuredProvidersLabel={
                                                    configuredSearchProvidersLabel
                                                }
                                                fundingLabel={webSearchFundingLabel}
                                                available={webSearchAvailable}
                                            />
                                        </div>
                                        <Switch
                                            checked={
                                                webSearchAvailable &&
                                                enabledTools.includes("web_search")
                                            }
                                            onCheckedChange={handleWebSearchToggle}
                                            disabled={webSearchDisabled}
                                        />
                                    </CommandItem>

                                    <CommandItem className="flex items-center justify-between p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-4 items-center justify-center">
                                                <SupermemoryIcon />
                                            </div>
                                            <span className="text-sm">Supermemory</span>
                                        </div>
                                        <Switch
                                            checked={
                                                supermemoryAvailable &&
                                                enabledTools.includes("supermemory")
                                            }
                                            onCheckedChange={handleSupermemoryToggle}
                                            disabled={!supermemoryAvailable}
                                        />
                                    </CommandItem>

                                    <CommandItem
                                        className={cn(
                                            "flex items-center justify-between p-3",
                                            !silkScreenAvailable && "cursor-not-allowed opacity-50"
                                        )}
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Image className="h-4 w-4 shrink-0" />
                                            <span className="text-sm">SilkScreen</span>
                                            <SilkScreenInfoButton
                                                isMobile={isMobile}
                                                available={silkScreenAvailable}
                                            />
                                        </div>
                                        <span className="shrink-0 text-muted-foreground text-xs">
                                            {silkScreenAvailable ? "Auto" : "Unavailable"}
                                        </span>
                                    </CommandItem>

                                    <CommandItem
                                        className={cn(
                                            "flex items-center justify-between gap-3 p-3",
                                            !silkScreenAvailable && "cursor-not-allowed opacity-50"
                                        )}
                                    >
                                        <span className="text-sm">Default resolution</span>
                                        <div className="flex items-center gap-1">
                                            {IMAGE_RESOLUTION_OPTIONS.map((option) => {
                                                const isActive = defaultImageResolution === option
                                                return (
                                                    <button
                                                        key={option}
                                                        type="button"
                                                        disabled={!silkScreenAvailable}
                                                        className={cn(
                                                            "flex h-6 min-w-9 items-center justify-center rounded border px-2 text-xs tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                                                            isActive
                                                                ? "border-primary bg-primary text-primary-foreground"
                                                                : "border-border/60 text-foreground hover:bg-muted/60"
                                                        )}
                                                        onClick={() => {
                                                            if (!silkScreenAvailable) return
                                                            void updateImageDefaults({
                                                                resolution: option
                                                            })
                                                        }}
                                                    >
                                                        {option}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </CommandItem>

                                    <CommandItem
                                        className={cn(
                                            "flex items-center justify-between gap-3 p-3",
                                            !silkScreenAvailable && "cursor-not-allowed opacity-50"
                                        )}
                                    >
                                        <span className="text-sm">Default variants</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                className="flex h-6 w-6 items-center justify-center rounded border border-border/60 text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                                                disabled={
                                                    !silkScreenAvailable ||
                                                    defaultImageVariants <= 1
                                                }
                                                onClick={() => {
                                                    if (!silkScreenAvailable) return
                                                    void updateImageDefaults({
                                                        variants: Math.max(
                                                            1,
                                                            defaultImageVariants - 1
                                                        )
                                                    })
                                                }}
                                            >
                                                -
                                            </button>
                                            <div className="min-w-6 text-center text-sm tabular-nums">
                                                {defaultImageVariants}
                                            </div>
                                            <button
                                                type="button"
                                                className="flex h-6 w-6 items-center justify-center rounded border border-border/60 text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                                                disabled={
                                                    !silkScreenAvailable ||
                                                    defaultImageVariants >= MAX_DEFAULT_VARIANTS
                                                }
                                                onClick={() => {
                                                    if (!silkScreenAvailable) return
                                                    void updateImageDefaults({
                                                        variants: Math.min(
                                                            MAX_DEFAULT_VARIANTS,
                                                            defaultImageVariants + 1
                                                        )
                                                    })
                                                }}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </CommandItem>
                                </CommandGroup>

                                <CommandGroup heading="MCP Servers">
                                    {hasMcpServers ? (
                                        mcpServers.map((server) => {
                                            const isEnabled =
                                                currentMcpOverrides[server.name] !== false
                                            return (
                                                <CommandItem
                                                    key={server.name}
                                                    className="flex items-center justify-between p-3"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex size-4 items-center justify-center">
                                                            <MCPIcon />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm">
                                                                {server.name}
                                                            </span>
                                                            <Badge
                                                                variant="secondary"
                                                                className="text-xs"
                                                            >
                                                                {server.type.toUpperCase()}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <Switch
                                                        checked={isEnabled}
                                                        onCheckedChange={(enabled) =>
                                                            handleMcpServerToggle(
                                                                server.name,
                                                                enabled
                                                            )
                                                        }
                                                    />
                                                </CommandItem>
                                            )
                                        })
                                    ) : (
                                        <CommandItem
                                            className="flex cursor-not-allowed items-center justify-between p-3 opacity-50"
                                            disabled
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-4 items-center justify-center">
                                                    <MCPIcon />
                                                </div>
                                                <span className="text-sm">MCP Servers</span>
                                            </div>
                                            <Switch checked={false} disabled />
                                        </CommandItem>
                                    )}
                                </CommandGroup>

                                <CommandGroup heading="Limits">
                                    <CommandItem
                                        className={cn(
                                            "flex items-center justify-between gap-3 p-3",
                                            activeCount === 0 && "cursor-not-allowed opacity-50"
                                        )}
                                    >
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span className="text-sm">Tool Calls</span>
                                            <ToolCallLimitInfoButton isMobile={isMobile} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                className="flex h-6 w-6 items-center justify-center rounded border border-border/60 text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                                                disabled={
                                                    activeCount === 0 ||
                                                    effectiveToolCallLimit <=
                                                        MIN_TOOL_CALL_LIMIT_PER_TURN
                                                }
                                                onClick={() => {
                                                    void updateToolCallLimit(
                                                        Math.max(
                                                            MIN_TOOL_CALL_LIMIT_PER_TURN,
                                                            effectiveToolCallLimit - 1
                                                        ),
                                                        activeCount > 0
                                                    )
                                                }}
                                            >
                                                -
                                            </button>
                                            <div className="min-w-7 text-center text-sm tabular-nums">
                                                {effectiveToolCallLimit ||
                                                    DEFAULT_TOOL_CALL_LIMIT_PER_TURN}
                                            </div>
                                            <button
                                                type="button"
                                                className="flex h-6 w-6 items-center justify-center rounded border border-border/60 text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                                                disabled={
                                                    activeCount === 0 ||
                                                    effectiveToolCallLimit >=
                                                        MAX_TOOL_CALL_LIMIT_PER_TURN
                                                }
                                                onClick={() => {
                                                    void updateToolCallLimit(
                                                        Math.min(
                                                            MAX_TOOL_CALL_LIMIT_PER_TURN,
                                                            effectiveToolCallLimit + 1
                                                        ),
                                                        activeCount > 0
                                                    )
                                                }}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </CommandItem>
                                </CommandGroup>

                                {!modelSupportsFunctionCalling && (
                                    <div className="px-4 py-3 text-center text-muted-foreground text-sm">
                                        Current model doesn't support function calling
                                    </div>
                                )}
                            </div>
                        </CommandList>
                    </Command>
                </ResponsivePopoverContent>
            </ResponsivePopover>
        )
    }
)
