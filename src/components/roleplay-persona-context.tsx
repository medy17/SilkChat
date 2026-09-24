import type { RoleplayPersona } from "@/lib/roleplay-persona"
import { createContext } from "react"

export const RoleplayPersonaContext = createContext<RoleplayPersona | undefined>(undefined)
export const RoleplayPersonaProvider = RoleplayPersonaContext.Provider

// The signed-in user's OAuth profile image, bound to the reserved id="user" character.
// Only the owner's chat supplies it; shared views keep initials.
export const RoleplayUserImageContext = createContext<string | undefined>(undefined)
export const RoleplayUserImageProvider = RoleplayUserImageContext.Provider
