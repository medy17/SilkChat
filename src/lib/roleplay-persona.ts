export type RoleplayPersona = {
    name: string
    avatarKind?: "builtin" | "r2"
    avatarValue?: string
}

export function matchRoleplayPersona(
    characterId: string | undefined,
    persona?: RoleplayPersona | null
): RoleplayPersona | undefined {
    return characterId === "persona" ? (persona ?? undefined) : undefined
}

// Once a thread exists, even a loading/non-Persona result must not borrow the
// currently selected composer Persona from another conversation.
export function selectRoleplayPersona({
    hasThread,
    saved,
    selected
}: {
    hasThread: boolean
    saved?: RoleplayPersona | null
    selected?: RoleplayPersona | null
}): RoleplayPersona | undefined {
    return (hasThread ? saved : selected) ?? undefined
}
