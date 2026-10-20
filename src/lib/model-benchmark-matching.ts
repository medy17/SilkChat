const toCompactName = (value?: string) => value?.toLowerCase().replace(/[^a-z0-9]+/g, "") ?? ""
const stripNameQualifiers = (name?: string) => name?.replace(/\s*\([^)]*\)/g, "")

// Artificial Analysis slugs mirror OpenRouter's model part with dots as hyphens
// ("z-ai/glm-5.3" -> "glm-5-3"). Dated checkpoints keep the date only in the name
// ("deepseek-v4-pro-0813" -> "DeepSeek V4 Pro 0813 (Max)"), so names are compared too.
export const findEntryByOpenRouterSlug = <TEntry extends { slug?: string; name?: string }>(
    openRouterSlug: string,
    dataset: TEntry[],
    options: { reasoning: boolean }
) => {
    const modelPart = openRouterSlug.split(":")[0].split("/").pop()?.toLowerCase()
    if (!modelPart) return null

    const base = modelPart.replace(/\./g, "-")
    const bases = [...new Set([base, base.replace(/-(preview|it|instruct)$/, "")])]
    // Older entries use the bare slug for the non-reasoning run.
    const slugs = options.reasoning
        ? bases.flatMap((slug) => [`${slug}-reasoning`, `${slug}-thinking`, slug])
        : bases

    for (const slug of slugs) {
        const matchedBySlug = dataset.find((entry) => entry.slug === slug)
        if (matchedBySlug) return matchedBySlug
    }

    const names = new Set(bases.map(toCompactName))
    return (
        dataset.find(
            (entry) =>
                names.has(toCompactName(stripNameQualifiers(entry.name))) ||
                names.has(toCompactName(entry.name))
        ) ?? null
    )
}
