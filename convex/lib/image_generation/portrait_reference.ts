import { BUILT_IN_PERSONAS } from "@/lib/personas/builtins"

// Only saved Persona assets qualify for the automatic reference. Imported external
// avatar URLs can still render, but are not silently sent to the image provider.
export function getPortraitStyleSource(avatarKind?: "builtin" | "r2", avatarValue?: string) {
    if (!avatarValue) return undefined
    if (avatarKind === "builtin" && BUILT_IN_PERSONAS.some((p) => p.avatarPath === avatarValue)) {
        return { key: avatarValue, url: new URL(avatarValue, "https://silkchat.dev").href }
    }
    if (avatarKind === "r2" && avatarValue.startsWith("persona-avatars/")) {
        return { key: avatarValue }
    }
    return undefined
}
