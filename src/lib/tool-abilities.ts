export const ABILITIES = [
    "web_search",
    "code_execution",
    "mathematical_instruments",
    "supermemory"
] as const
export type AbilityId = (typeof ABILITIES)[number]
