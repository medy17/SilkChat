import type { AbilityId } from "@/lib/tool-abilities"
import type { Infer } from "convex/values"
import type { UserSettings } from "../../schema/settings"

export type ToolFundingSource = "byok" | "deployment" | "none"

export type ResolvedToolAvailability = {
    enabled: boolean
    fundingSource: ToolFundingSource
}

export type ResolvedToolAvailabilityMap = Record<AbilityId, ResolvedToolAvailability>

export const getDeploymentSearchApiKey = () => process.env.PERPLEXITY_API_KEY?.trim()

const hasEnabledProviderKey = (provider: { enabled: boolean; encryptedKey: string } | undefined) =>
    provider?.enabled === true && Boolean(provider.encryptedKey)

export const resolveToolAvailability = (
    userSettings: Infer<typeof UserSettings>
): ResolvedToolAvailabilityMap => {
    const hasSearchDeployment = Boolean(getDeploymentSearchApiKey())
    const hasSupermemoryByok = hasEnabledProviderKey(userSettings.generalProviders?.supermemory)
    const hasMcpServers = (userSettings.mcpServers ?? []).some((server) => server.enabled !== false)

    return {
        web_search: {
            enabled: hasSearchDeployment,
            fundingSource: hasSearchDeployment ? "deployment" : "none"
        },
        supermemory: {
            enabled: hasSupermemoryByok,
            fundingSource: hasSupermemoryByok ? "byok" : "none"
        },
        mcp: {
            enabled: hasMcpServers,
            fundingSource: hasMcpServers ? "byok" : "none"
        }
    }
}

export const sanitizeEnabledTools = (
    enabledTools: AbilityId[],
    availability: ResolvedToolAvailabilityMap
): AbilityId[] => {
    const uniqueTools = Array.from(new Set(enabledTools))
    return uniqueTools.filter((tool) => availability[tool]?.enabled)
}
