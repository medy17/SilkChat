import { broodingStrangerPersona } from "./brooding-stranger"
import { elaraAdventurerPersona } from "./elara-adventurer"
import { essayColumnistPersona } from "./essay-columnist"
import { mourinhoPersona } from "./jose-mourinho"
import { lucianVampirePersona } from "./lucian-vampire"
import { mondayPersona } from "./monday"
import { nyxNetrunnerPersona } from "./nyx-netrunner"
import { pepGuardiolaPersona } from "./pep-guardiola"
import { schemingBastardPersona } from "./scheming-bastard"
import { seniorCodeReviewerPersona } from "./senior-code-reviewer"
import { seraphineFaePersona } from "./seraphine-fae"
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
    mondayPersona,
    pepGuardiolaPersona,
    schemingBastardPersona,
    seniorCodeReviewerPersona,
    socraticTutorPersona,
    seraphineFaePersona,
    broodingStrangerPersona,
    nyxNetrunnerPersona,
    lucianVampirePersona,
    elaraAdventurerPersona
]

export const getBuiltInPersonaById = (id: string) =>
    BUILT_IN_PERSONAS.find((persona) => persona.id === id) ?? null
