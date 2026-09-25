import type { RoleplayPersona } from "@/lib/roleplay-persona"
import type { RoleplayPortrait } from "@/lib/roleplay-portraits"
import { createContext } from "react"

export const RoleplayPersonaContext = createContext<RoleplayPersona | undefined>(undefined)
export const RoleplayPersonaProvider = RoleplayPersonaContext.Provider

// The signed-in user's OAuth profile image, bound to the reserved id="user" character.
// Only the owner's chat supplies it; shared views keep initials.
export const RoleplayUserImageContext = createContext<string | undefined>(undefined)
export const RoleplayUserImageProvider = RoleplayUserImageContext.Provider

// Shared views supply only portraits. The owner's chat also supplies the editable
// thread ID; card actions require it.
export type RoleplayPortraitsValue = {
    threadId?: string
    portraits: readonly RoleplayPortrait[]
}
export const RoleplayPortraitsContext = createContext<RoleplayPortraitsValue | undefined>(undefined)
export const RoleplayPortraitsProvider = RoleplayPortraitsContext.Provider
