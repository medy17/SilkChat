export const ABILITIES = ["web_search", "code_execution", "supermemory", "mcp"] as const
export type AbilityId = (typeof ABILITIES)[number]
