import type { ImageQuality } from "@/convex/lib/models"
import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { ContextRingLevel, ContextRingVisibility } from "@/lib/composer-context"
import { canUseDevTools, useDevToolsStore } from "@/lib/dev-tools"
import { useMemo } from "react"

/**
 * Dev override switches. These intentionally live in their own persisted store so the
 * plain dev-tools store (mode + dock visibility) stays cheap to read everywhere, while
 * override consumers only subscribe when they actually care.
 *
 * Overrides are hard-gated by {@link canUseDevTools} and only take effect while the dock
 * is in "dev" mode — in "user" mode the app must behave exactly like production.
 */
export type DevOverridesState = {
    disableAnimations: boolean
    rawMarkdown: boolean
    themeAudit: boolean
    // Image lab overrides (wired in a later wave). null means "use the model/default cap".
    imageVariantMax: number | null
    imageReferenceMax: number | null
    imageRunTotalMax: number | null
    aspectRatioOverride: string | null
    disableImageCompression: boolean
    imageQualityOverrides: Partial<Record<string, Exclude<ImageQuality, "auto">>>
    // Chat hosted/model context-limit overrides (Wave 3). null = use the real limits.
    hostedContextLimitOverride: number | null
    modelContextLimitOverride: number | null
    // Composer context ring. null = the product defaults.
    contextRingVisibility: ContextRingVisibility
    contextRingShowFromPercent: number | null
    contextRingLevels: ContextRingLevel[] | null
    setDisableAnimations: (value: boolean) => void
    setRawMarkdown: (value: boolean) => void
    setThemeAudit: (value: boolean) => void
    setImageVariantMax: (value: number | null) => void
    setImageReferenceMax: (value: number | null) => void
    setImageRunTotalMax: (value: number | null) => void
    setAspectRatioOverride: (value: string | null) => void
    setDisableImageCompression: (value: boolean) => void
    resetImageQualityOverrides: () => void
    setImageQualityOverride: (modelId: string, value: Exclude<ImageQuality, "auto">) => void
    setHostedContextLimitOverride: (value: number | null) => void
    setModelContextLimitOverride: (value: number | null) => void
    setContextRingVisibility: (value: ContextRingVisibility) => void
    setContextRingShowFromPercent: (value: number | null) => void
    setContextRingLevels: (value: ContextRingLevel[] | null) => void
    resetOverrides: () => void
}

export const DEV_OVERRIDES_STORE_KEY = "dev-overrides-store"

const OVERRIDE_DEFAULTS = {
    disableAnimations: false,
    rawMarkdown: false,
    themeAudit: false,
    imageVariantMax: null,
    imageReferenceMax: null,
    imageRunTotalMax: null,
    aspectRatioOverride: null,
    disableImageCompression: false,
    imageQualityOverrides: {},
    hostedContextLimitOverride: null,
    modelContextLimitOverride: null,
    contextRingVisibility: "auto",
    contextRingShowFromPercent: null,
    contextRingLevels: null
} satisfies Omit<
    DevOverridesState,
    | "setDisableAnimations"
    | "setRawMarkdown"
    | "setThemeAudit"
    | "setImageVariantMax"
    | "setImageReferenceMax"
    | "setImageRunTotalMax"
    | "setAspectRatioOverride"
    | "setDisableImageCompression"
    | "setImageQualityOverride"
    | "resetImageQualityOverrides"
    | "setHostedContextLimitOverride"
    | "setModelContextLimitOverride"
    | "setContextRingVisibility"
    | "setContextRingShowFromPercent"
    | "setContextRingLevels"
    | "resetOverrides"
>

export const useDevOverridesStore = create<DevOverridesState>()(
    persist(
        (set) => ({
            ...OVERRIDE_DEFAULTS,
            setDisableAnimations: (disableAnimations) => set({ disableAnimations }),
            setRawMarkdown: (rawMarkdown) => set({ rawMarkdown }),
            setThemeAudit: (themeAudit) => set({ themeAudit }),
            setImageVariantMax: (imageVariantMax) => set({ imageVariantMax }),
            setImageReferenceMax: (imageReferenceMax) => set({ imageReferenceMax }),
            setImageRunTotalMax: (imageRunTotalMax) => set({ imageRunTotalMax }),
            setAspectRatioOverride: (aspectRatioOverride) => set({ aspectRatioOverride }),
            setDisableImageCompression: (disableImageCompression) =>
                set({ disableImageCompression }),
            resetImageQualityOverrides: () => set({ imageQualityOverrides: {} }),
            setImageQualityOverride: (modelId, quality) =>
                set((state) => ({
                    imageQualityOverrides: { ...state.imageQualityOverrides, [modelId]: quality }
                })),
            setHostedContextLimitOverride: (hostedContextLimitOverride) =>
                set({ hostedContextLimitOverride }),
            setModelContextLimitOverride: (modelContextLimitOverride) =>
                set({ modelContextLimitOverride }),
            setContextRingVisibility: (contextRingVisibility) => set({ contextRingVisibility }),
            setContextRingShowFromPercent: (contextRingShowFromPercent) =>
                set({ contextRingShowFromPercent }),
            setContextRingLevels: (contextRingLevels) => set({ contextRingLevels }),
            resetOverrides: () => set({ ...OVERRIDE_DEFAULTS })
        }),
        {
            name: DEV_OVERRIDES_STORE_KEY
        }
    )
)

/**
 * True only when dev tooling is available for this build AND the dock is in dev mode.
 * Every override consumer folds this in so user mode is untouched.
 */
export const useAreDevOverridesActive = () => {
    const mode = useDevToolsStore((state) => state.mode)
    return canUseDevTools() && mode === "dev"
}

export const useDevDisableAnimations = () => {
    const active = useAreDevOverridesActive()
    const disableAnimations = useDevOverridesStore((state) => state.disableAnimations)
    return active && disableAnimations
}

export const useDevRawMarkdown = () => {
    const active = useAreDevOverridesActive()
    const rawMarkdown = useDevOverridesStore((state) => state.rawMarkdown)
    return active && rawMarkdown
}

export const useDevThemeAudit = () => {
    const active = useAreDevOverridesActive()
    const themeAudit = useDevOverridesStore((state) => state.themeAudit)
    return active && themeAudit
}

/**
 * Fold a numeric cap override in: when overrides are active and a value is set, it wins
 * (clamped to `floor`); otherwise the real fallback cap applies. Pure so consumers'
 * cap-resolution logic stays testable.
 */
export const resolveDevCapOverride = (
    active: boolean,
    override: number | null,
    fallback: number,
    floor: number
): number => (active && override != null ? Math.max(floor, override) : fallback)

/**
 * Reference-image limit variant: the base may be undefined (model has no limit), and an
 * active override replaces it entirely (floored at 0).
 */
export const resolveDevReferenceLimit = (
    active: boolean,
    override: number | null,
    base: number | undefined
): number | undefined => (active && override != null ? Math.max(0, override) : base)

export type DevContextOverride = { hostedInputLimit?: number; modelInputLimit?: number }

/**
 * Non-reactive read of the active chat context-limit override, for injection into the
 * chat request body at send time. Returns undefined unless dev tooling is available, the
 * dock is in dev mode, and at least one limit is set. The backend still ignores it in
 * production (it's gated by DEV_CREDIT_LAB_ENABLED there).
 */
export const getActiveDevContextOverride = (): DevContextOverride | undefined => {
    if (!canUseDevTools() || useDevToolsStore.getState().mode !== "dev") return undefined

    const { hostedContextLimitOverride, modelContextLimitOverride } =
        useDevOverridesStore.getState()
    if (hostedContextLimitOverride == null && modelContextLimitOverride == null) return undefined

    return {
        ...(hostedContextLimitOverride != null
            ? { hostedInputLimit: hostedContextLimitOverride }
            : {}),
        ...(modelContextLimitOverride != null ? { modelInputLimit: modelContextLimitOverride } : {})
    }
}

/** The context-limit overrides the next send carries, reactive so the composer agrees with it. */
export const useActiveDevContextOverride = (): DevContextOverride | undefined => {
    const active = useAreDevOverridesActive()
    const hosted = useDevOverridesStore((state) => state.hostedContextLimitOverride)
    const model = useDevOverridesStore((state) => state.modelContextLimitOverride)
    return useMemo(() => {
        if (!active || (hosted == null && model == null)) return undefined
        return {
            ...(hosted != null ? { hostedInputLimit: hosted } : {}),
            ...(model != null ? { modelInputLimit: model } : {})
        }
    }, [active, hosted, model])
}

/** Ring overrides while dev mode is on; null means the product behaviour. */
export const useDevContextRingSettings = () => {
    const active = useAreDevOverridesActive()
    const visibility = useDevOverridesStore((state) => state.contextRingVisibility)
    const showFromPercent = useDevOverridesStore((state) => state.contextRingShowFromPercent)
    const levels = useDevOverridesStore((state) => state.contextRingLevels)
    return useMemo(
        () => (active ? { visibility, showFromPercent, levels } : null),
        [active, visibility, showFromPercent, levels]
    )
}
