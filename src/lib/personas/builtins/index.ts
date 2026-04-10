import { essayColumnistPersona } from "./essay-columnist"
import { mourinhoPersona } from "./jose-mourinho"
import { pepGuardiolaPersona } from "./pep-guardiola"
import { schemingAssholePersona } from "./scheming-asshole"
import { seniorCodeReviewerPersona } from "./senior-code-reviewer"
import { socraticTutorPersona } from "./socratic-tutor"

export const MAX_PERSONA_KNOWLEDGE_DOCS = 5
export const MAX_PERSONA_PROMPT_TOKENS = 20_000
export const MAX_PERSONA_AVATAR_BYTES = 100 * 1024
export const MIN_PERSONA_STARTERS = 2
export const MAX_PERSONA_STARTERS = 5

export type { BuiltInPersona, BuiltInPersonaDoc } from "./types"

export const BUILT_IN_PERSONAS = [
    essayColumnistPersona,
    mourinhoPersona,
    pepGuardiolaPersona,
    schemingAssholePersona,
    seniorCodeReviewerPersona,
    socraticTutorPersona
]

export const getBuiltInPersonaById = (id: string) =>
    BUILT_IN_PERSONAS.find((persona) => persona.id === id) ?? null
