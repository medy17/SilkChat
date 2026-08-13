export const ABILITIES = [
    "web_search",
    "code_execution",
    "mathematical_instruments",
    "electrical_engineering",
    "supermemory",
    "mcp"
] as const
export type AbilityId = (typeof ABILITIES)[number]
