export type GeneratedImageRecoveryPhase = "primary" | "fallback" | "error"

type GeneratedImagePrimarySource = {
    src: string
    srcSet?: string
    sizes?: string
}

type GeneratedImageFallbackSource = {
    directSrc: string
}

export const getNextGeneratedImageRecoveryPhase = (
    currentPhase: GeneratedImageRecoveryPhase
): GeneratedImageRecoveryPhase => {
    if (currentPhase === "primary") {
        return "fallback"
    }

    return "error"
}

export const resolveGeneratedImageRenderSource = ({
    phase,
    primary,
    fallback
}: {
    phase: GeneratedImageRecoveryPhase
    primary: GeneratedImagePrimarySource
    fallback: GeneratedImageFallbackSource
}) => {
    if (phase === "fallback") {
        return {
            src: fallback.directSrc
        }
    }

    return {
        src: primary.src,
        srcSet: primary.srcSet,
        sizes: primary.sizes
    }
}
