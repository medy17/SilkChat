export const getVisualAvailability = ({
    abilities,
    isAnonymous,
    hasSearchKey,
    hasPublicDelivery
}: {
    abilities: readonly string[]
    isAnonymous?: boolean
    hasSearchKey: boolean
    hasPublicDelivery: boolean
}) => {
    const resolveVisuals = !isAnonymous && hasSearchKey && hasPublicDelivery
    return {
        resolveVisuals,
        imageSearch:
            resolveVisuals && abilities.includes("vision") && abilities.includes("function_calling")
    }
}
