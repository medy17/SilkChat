import type { ModelAbility } from "../schema/settings"

export type StoredModelAbility = ModelAbility | "pdf"

export const NATIVE_PDF_MODEL_ABILITY = "native_pdf" satisfies ModelAbility

export const normalizeModelAbility = (ability: StoredModelAbility): ModelAbility =>
    ability === "pdf" ? NATIVE_PDF_MODEL_ABILITY : ability

export const normalizeModelAbilities = (abilities: readonly StoredModelAbility[]): ModelAbility[] =>
    Array.from(new Set(abilities.map(normalizeModelAbility)))

export const supportsNativePdf = (abilities: readonly StoredModelAbility[]) =>
    normalizeModelAbilities(abilities).includes(NATIVE_PDF_MODEL_ABILITY)
