import { BUILT_IN_PERSONAS } from "@/lib/personas/builtins"

// Only saved Persona assets qualify for the automatic reference. Imported external
// avatar URLs can still render, but are not silently sent to the image provider.
export function getPortraitStyleSource(avatarKind?: "builtin" | "r2", avatarValue?: string) {
    if (!avatarValue) return undefined
    if (avatarKind === "builtin" && BUILT_IN_PERSONAS.some((p) => p.avatarPath === avatarValue)) {
        return { kind: "builtin" as const, key: avatarValue }
    }
    if (avatarKind === "r2" && avatarValue.startsWith("persona-avatars/")) {
        return { kind: "r2" as const, key: avatarValue }
    }
    return undefined
}

export function getPublicPortraitReferenceUrl(publicPath: string, appOrigin?: string) {
    if (!appOrigin?.trim()) throw new Error("The public app origin is not configured.")
    const origin = new URL(appOrigin)
    if (!/^https?:$/.test(origin.protocol) || origin.username || origin.password) {
        throw new Error("The public app origin must be an HTTP(S) origin.")
    }
    return new URL(publicPath, origin.origin).href
}
