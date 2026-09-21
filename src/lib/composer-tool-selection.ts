import type { ResolvedToolAvailabilityMap } from "@/convex/lib/tools/availability"
import type { AbilityId } from "@/lib/tool-abilities"

export function filterComposerTools(
    enabledTools: AbilityId[],
    availability: ResolvedToolAvailabilityMap | null,
    supportsFunctionCalling: boolean | undefined
): AbilityId[] {
    // Loading is not evidence that a saved choice is unavailable.
    if (!availability || supportsFunctionCalling === undefined) return enabledTools
    return enabledTools.filter(
        (tool) => tool === "supermemory" || (supportsFunctionCalling && availability[tool]?.enabled)
    )
}
