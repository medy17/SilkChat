export type PrivateViewingOverride = "hidden" | "visible"

interface ImageHiddenStateInput {
    privateViewingEnabled: boolean
    override?: PrivateViewingOverride
}

export function getIsImageHidden({
    privateViewingEnabled,
    override
}: ImageHiddenStateInput): boolean {
    if (privateViewingEnabled) {
        return override !== "visible"
    }

    return override === "hidden"
}

export function getNextPrivateViewingOverride({
    privateViewingEnabled,
    override
}: ImageHiddenStateInput): PrivateViewingOverride | undefined {
    const isCurrentlyHidden = getIsImageHidden({
        privateViewingEnabled,
        override
    })
    const nextHiddenState = !isCurrentlyHidden
    const defaultHiddenState = privateViewingEnabled

    if (nextHiddenState === defaultHiddenState) {
        return undefined
    }

    return nextHiddenState ? "hidden" : "visible"
}
