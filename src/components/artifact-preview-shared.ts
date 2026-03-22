export const ARTIFACT_SUPPORTED_LANGUAGES = [
    "mermaid",
    "html",
    "react",
    "jsx",
    "tsx",
    "markdown",
    "md"
] as const

export type ArtifactLanguage = (typeof ARTIFACT_SUPPORTED_LANGUAGES)[number]

export function isArtifactSupported(language: string): language is ArtifactLanguage {
    return ARTIFACT_SUPPORTED_LANGUAGES.includes(language as ArtifactLanguage)
}
