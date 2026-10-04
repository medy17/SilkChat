import { splitRoleplayContent } from "./roleplay"
import { parseRecipeBlock, splitRecipeContent } from "./recipe"
import { MAX_VISUAL_SEARCHES, splitVisualContent, type VisualReference } from "./visual-references"

export type StoredVisual = VisualReference & {
    storageKey: string
    originalUrl: string
    confidence?: string
    pageFetched?: string
    searchQuery?: string
}
export type VisualSelection = { key: string; cue: string; visuals: StoredVisual[] }

// Only model-selected images are reusable inputs. Quick looks remain display-only.
export const isReferentialVisualSelection = (selection: Pick<VisualSelection, "key">) =>
    selection.key.startsWith('["refs",')

export type VisualRequest = {
    cue: string
    variant: "gallery" | "step"
    limit: number
    refs?: string[]
}

export const getVisualSearchQueries = (
    request: Pick<VisualRequest, "cue" | "refs">,
    visuals: readonly Pick<StoredVisual, "searchQuery">[]
) =>
    request.refs === undefined && request.cue
        ? [request.cue]
        : Array.from(
              new Set(
                  visuals
                      .map((image) => image.searchQuery)
                      .filter((query): query is string => Boolean(query))
              )
          )

export const visualRequestKey = ({ cue, variant, limit, refs }: VisualRequest) =>
    refs !== undefined
        ? JSON.stringify(["refs", variant, limit, refs])
        : JSON.stringify([variant, cue.replace(/\s+/g, " ").trim().slice(0, 160), limit])

// Share the renderer's parsers: examples in code fences and roleplay are never searches.
export const collectVisualRequests = (text: string): VisualRequest[] => {
    const requests: VisualRequest[] = []
    let standaloneCount = 0
    for (const role of splitRoleplayContent(text)) {
        if (role.type !== "markdown") continue
        for (const segment of splitRecipeContent(role.content)) {
            if (segment.type === "recipe") {
                const recipe = parseRecipeBlock(segment.content, segment.openingAttributes)
                if (!recipe) continue
                if (recipe.visualCue)
                    requests.push({ cue: recipe.visualCue, variant: "gallery", limit: 3 })
                for (const step of recipe.steps) {
                    if (step.visualCue || step.visualRefs !== undefined)
                        requests.push({
                            cue: step.visualCue ?? "",
                            variant: "step",
                            limit: 1,
                            ...(step.visualRefs !== undefined ? { refs: step.visualRefs } : {})
                        })
                }
            } else {
                for (const visual of splitVisualContent(segment.content)) {
                    if (visual.type !== "visual" || ++standaloneCount > MAX_VISUAL_SEARCHES)
                        continue
                    requests.push({
                        cue: visual.cue,
                        variant: "gallery",
                        limit: 3,
                        ...(visual.refs !== undefined ? { refs: visual.refs } : {})
                    })
                }
            }
        }
    }
    // Bound the whole response as well as individual recipes.
    let quickLooks = 0
    return Array.from(
        new Map(requests.map((request) => [visualRequestKey(request), request])).values()
    )
        .filter((request) => request.refs !== undefined || ++quickLooks <= MAX_VISUAL_SEARCHES)
        .slice(0, 12)
}
