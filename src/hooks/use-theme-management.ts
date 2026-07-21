import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { useResolvedThemeMode } from "@/hooks/use-resolved-theme-mode"
import { MAX_IMPORTED_THEMES } from "@/lib/imported-theme-limits"
import type { ThemeMode } from "@/lib/theme-mode"
import {
    LEGACY_GREEN_THEME_URL,
    getLegacyGreenThemeState,
    isDefaultThemeCssVars,
    isLegacyGreenThemeCssVars,
    useThemeStore
} from "@/lib/theme-store"
import {
    type FetchedTheme,
    THEME_URLS,
    type ThemePreset,
    fetchThemeFromUrl,
    getBuiltInThemeUrl,
    isMissingImportedThemeSelection
} from "@/lib/theme-utils"
import { toggleThemeMode } from "@/lib/toggle-theme-mode"
import { useConvexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { useMutation } from "convex/react"
import isEqual from "fast-deep-equal"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

export function useThemeManagement() {
    const session = useSession()
    const {
        themeState,
        selectedThemeUrl,
        setThemeState,
        setSelectedThemeUrl,
        resetThemeToDefault
    } = useThemeStore()
    const [searchQuery, setSearchQuery] = useState("")
    const resolvedMode = useResolvedThemeMode(themeState.currentMode)

    // Fetch user settings to retrieve custom theme URLs
    const userSettings = useConvexQuery(
        api.settings.getUserSettings,
        session.user?.id ? {} : "skip"
    )

    const addTheme = useMutation(api.settings.addUserTheme)
    const deleteTheme = useMutation(api.settings.deleteUserTheme)

    const importedThemeUrls = useMemo<string[]>(() => {
        if (!userSettings || "error" in userSettings) return []
        return Array.from(
            new Set(
                ((userSettings.customThemes ?? []) as string[]).filter(
                    (url) => !getBuiltInThemeUrl(url)
                )
            )
        )
    }, [userSettings])

    // Combine built-in and user-saved theme URLs (deduplicated)
    const allThemeUrls = useMemo(() => {
        const urlSet = new Set<string>(THEME_URLS)
        importedThemeUrls.forEach((url) => urlSet.add(url))
        return Array.from(urlSet)
    }, [importedThemeUrls])

    const { data: fetchedThemes = [], isLoading: isLoadingThemes } = useQuery({
        queryKey: ["themes", allThemeUrls],
        queryFn: () => Promise.all(allThemeUrls.map(fetchThemeFromUrl)),
        enabled: allThemeUrls.length > 0,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000 // 10 minutes
    })

    const resolvedSelectedThemeUrl = useMemo(() => {
        if (selectedThemeUrl) {
            return selectedThemeUrl
        }

        if (isDefaultThemeCssVars(themeState.cssVars)) {
            return null
        }

        const matchedTheme = fetchedThemes.find(
            (theme) =>
                !("error" in theme && theme.error) &&
                isEqual(theme.preset.cssVars, themeState.cssVars)
        )

        return matchedTheme?.url ?? null
    }, [fetchedThemes, selectedThemeUrl, themeState.cssVars])

    const isDefaultThemeSelected = useMemo(
        () => isDefaultThemeCssVars(themeState.cssVars) && resolvedSelectedThemeUrl === null,
        [resolvedSelectedThemeUrl, themeState.cssVars]
    )

    const isLegacyGreenThemeSelected = useMemo(
        () =>
            resolvedSelectedThemeUrl === LEGACY_GREEN_THEME_URL &&
            isLegacyGreenThemeCssVars(themeState.cssVars),
        [resolvedSelectedThemeUrl, themeState.cssVars]
    )

    useEffect(() => {
        if (selectedThemeUrl || !resolvedSelectedThemeUrl) {
            return
        }

        setSelectedThemeUrl(resolvedSelectedThemeUrl)
    }, [resolvedSelectedThemeUrl, selectedThemeUrl, setSelectedThemeUrl])

    useEffect(() => {
        const settingsHaveLoaded = Boolean(
            session.user?.id && userSettings && !("error" in userSettings)
        )
        if (
            settingsHaveLoaded &&
            isMissingImportedThemeSelection(selectedThemeUrl, importedThemeUrls)
        ) {
            resetThemeToDefault()
        }
    }, [importedThemeUrls, resetThemeToDefault, selectedThemeUrl, session.user?.id, userSettings])

    useEffect(() => {
        if (!selectedThemeUrl || !THEME_URLS.includes(selectedThemeUrl)) {
            return
        }

        const selectedBuiltInTheme = fetchedThemes.find(
            (theme) => theme.url === selectedThemeUrl && !("error" in theme && theme.error)
        )

        if (
            selectedBuiltInTheme &&
            !isEqual(selectedBuiltInTheme.preset.cssVars, themeState.cssVars)
        ) {
            setThemeState({
                currentMode: themeState.currentMode,
                cssVars: selectedBuiltInTheme.preset.cssVars
            })
        }
    }, [fetchedThemes, selectedThemeUrl, setThemeState, themeState.currentMode, themeState.cssVars])

    const applyThemePreset = (preset: ThemePreset) => {
        setThemeState({
            currentMode: themeState.currentMode,
            cssVars: preset.cssVars
        })
    }

    const handleThemeImported = async (preset: ThemePreset, url: string) => {
        const builtInThemeUrl = getBuiltInThemeUrl(url)
        if (builtInThemeUrl) {
            toast.info("This theme is already included")
        } else {
            try {
                await addTheme({ url })
            } catch (error) {
                if (error instanceof Error && error.message.includes("You can save up to")) {
                    throw new Error(
                        `You can save up to ${MAX_IMPORTED_THEMES} themes. Remove one to add another.`
                    )
                }
                throw new Error("Couldn’t add this theme. Try again.")
            }
            toast.success("Theme added")
        }

        applyThemePreset(preset)
        setSelectedThemeUrl(builtInThemeUrl ?? url)
    }

    const handleThemeSelect = (theme: FetchedTheme) => {
        if ("error" in theme && theme.error) {
            return
        }

        if ("preset" in theme) {
            applyThemePreset(theme.preset)
            setSelectedThemeUrl(theme.url)
        }
    }

    const handleThemeDelete = async (url: string) => {
        if (THEME_URLS.includes(url)) return
        try {
            await deleteTheme({ url })
            if (resolvedSelectedThemeUrl === url) {
                resetThemeToDefault()
            }
            toast.success("Theme removed")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Couldn’t remove this theme")
        }
    }

    const toggleMode = () => {
        toggleThemeMode()
    }

    const setMode = (currentMode: ThemeMode) => {
        setThemeState({
            ...themeState,
            currentMode
        })
    }

    const resetToDefaultTheme = () => {
        resetThemeToDefault()
    }

    const selectLegacyGreenTheme = () => {
        setThemeState(getLegacyGreenThemeState(themeState.currentMode))
        setSelectedThemeUrl(LEGACY_GREEN_THEME_URL)
    }

    const randomizeTheme = () => {
        const availableThemes = fetchedThemes.filter((theme) => !("error" in theme && theme.error))
        if (availableThemes.length > 0) {
            const randomTheme = availableThemes[Math.floor(Math.random() * availableThemes.length)]
            handleThemeSelect(randomTheme)
        }
    }

    const filteredThemes = fetchedThemes.filter((theme) =>
        theme.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const customThemes = filteredThemes.filter((theme) => theme.type === "custom")
    const builtInThemes = filteredThemes.filter((theme) => theme.type === "built-in")

    return {
        // State
        themeState,
        resolvedMode,
        searchQuery,
        setSearchQuery,
        selectedThemeUrl: resolvedSelectedThemeUrl,
        isDefaultThemeSelected,
        isLegacyGreenThemeSelected,
        isLoadingThemes,
        fetchedThemes,
        filteredThemes,
        customThemes,
        builtInThemes,
        maxImportedThemes: MAX_IMPORTED_THEMES,
        canImportTheme: importedThemeUrls.length < MAX_IMPORTED_THEMES,

        // Actions
        handleThemeImported,
        handleThemeSelect,
        handleThemeDelete,
        toggleMode,
        setMode,
        randomizeTheme,
        resetToDefaultTheme,
        selectLegacyGreenTheme,
        applyThemePreset,

        // User session
        session
    }
}
