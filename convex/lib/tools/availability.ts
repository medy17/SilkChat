import type { AbilityId } from "@/lib/tool-abilities"
import type { Infer } from "convex/values"
import type { UserSettings } from "../../schema/settings"
import { getSupermemoryApiKey } from "../supermemory_api"

export type ToolFundingSource = "byok" | "deployment" | "none"

export type ResolvedToolAvailability = {
    enabled: boolean
    fundingSource: ToolFundingSource
}

export type ResolvedToolAvailabilityMap = Record<AbilityId, ResolvedToolAvailability>

export const getDeploymentSearchApiKey = () => process.env.PERPLEXITY_API_KEY?.trim()

const hasVercelSandboxCredentials = () =>
    Boolean(
        process.env.VERCEL_TEAM_ID?.trim() &&
            process.env.VERCEL_PROJECT_ID?.trim() &&
            process.env.VERCEL_TOKEN?.trim()
    )

export const resolveToolAvailability = (
    _userSettings: Infer<typeof UserSettings>
): ResolvedToolAvailabilityMap => {
    const hasSearchDeployment = Boolean(getDeploymentSearchApiKey())
    const hasCodeExecutionDeployment = hasVercelSandboxCredentials()
    const hasSupermemoryDeployment = Boolean(getSupermemoryApiKey())
    return {
        web_search: {
            enabled: hasSearchDeployment,
            fundingSource: hasSearchDeployment ? "deployment" : "none"
        },
        code_execution: {
            enabled: hasCodeExecutionDeployment,
            fundingSource: hasCodeExecutionDeployment ? "deployment" : "none"
        },
        mathematical_instruments: {
            enabled: true,
            fundingSource: "none"
        },
        supermemory: {
            enabled: hasSupermemoryDeployment,
            fundingSource: hasSupermemoryDeployment ? "deployment" : "none"
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

export const enforceToolIdentityPolicy = (
    enabledTools: AbilityId[],
    { isAnonymous }: { isAnonymous: boolean }
): AbilityId[] =>
    isAnonymous
        ? enabledTools.filter(
              (tool) =>
                  tool !== "code_execution" &&
                  tool !== "mathematical_instruments" &&
                  tool !== "supermemory"
          )
        : enabledTools
