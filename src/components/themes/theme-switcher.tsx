import { useIsMobile } from "@/hooks/use-mobile"
import { useThemeManagement } from "@/hooks/use-theme-management"
import { COLLAPSED_IMPORTED_THEME_COUNT } from "@/lib/imported-theme-limits"
import { DEFAULT_THEME_PRESET, LEGACY_GREEN_THEME_PRESET } from "@/lib/theme-store"
import { type FetchedTheme, extractThemeColors } from "@/lib/theme-utils"
import { cn } from "@/lib/utils"
import {
    CheckCircle,
    ChevronDown,
    ChevronUp,
    LoaderIcon,
    MonitorIcon,
    MoonIcon,
    PaintBucketIcon,
    PlusIcon,
    Search,
    ShuffleIcon,
    SunIcon,
    Trash2
} from "lucide-react"
import { useState } from "react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "../ui/alert-dialog"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import {
    ResponsivePopover,
    ResponsivePopoverContent,
    ResponsivePopoverTrigger
} from "../ui/responsive-popover"
import { Separator } from "../ui/separator"
import { ImportThemeDialog } from "./import-theme-dialog"

type ThemeButtonProps = {
    theme: FetchedTheme
    isSelected: boolean
    onSelect: (theme: FetchedTheme) => void
    onDelete?: (url: string) => void
    currentMode: "light" | "dark"
}

function ThemeButton({ theme, isSelected, onSelect, onDelete, currentMode }: ThemeButtonProps) {
    const colors =
        "error" in theme && theme.error
            ? []
            : "preset" in theme
              ? extractThemeColors(theme.preset, currentMode)
              : []

    return (
        <div className="group relative">
            <button
                type="button"
                key={theme.url}
                onClick={() => onSelect(theme)}
                className={cn(
                    "w-full cursor-pointer overflow-hidden rounded-lg border transition-all duration-200 hover:scale-[1.02] hover:shadow-md",
                    isSelected
                        ? "border-primary shadow-sm ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50",
                    "error" in theme &&
                        theme.error &&
                        "cursor-not-allowed opacity-50 hover:scale-100"
                )}
                disabled={"error" in theme && !!theme.error}
            >
                <div className={cn("flex items-center justify-between p-3", onDelete && "pr-10")}>
                    <div className="text-left">
                        <div className="font-medium text-sm">{theme.name}</div>
                        {isSelected && (
                            <div className="text-muted-foreground text-xs">Currently active</div>
                        )}
                    </div>
                    {isSelected && (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                            <CheckCircle className="size-4 text-primary" />
                        </div>
                    )}
                </div>
                {colors.length > 0 && (
                    <div className="flex h-2">
                        {colors.map((color, index) => (
                            <div
                                key={index}
                                className="flex-1"
                                style={{
                                    backgroundColor: color
                                }}
                            />
                        ))}
                    </div>
                )}
                {"error" in theme && theme.error && (
                    <div className="p-3 pt-2 text-destructive text-xs">Error: {theme.error}</div>
                )}
            </button>
            {onDelete && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-1.5 right-1.5 size-7 text-muted-foreground opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100"
                            aria-label={`Remove ${theme.name}`}
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Remove theme?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Remove “{theme.name}” from My Themes? It’ll also disappear from your
                                other devices.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => onDelete(theme.url)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Remove
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    )
}

export function ThemeSwitcher({
    buttonVariant = "outline"
}: {
    buttonVariant?: "outline" | "ghost"
}) {
    const isMobile = useIsMobile()
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
    const [showAllImportedThemes, setShowAllImportedThemes] = useState(false)

    const {
        themeState,
        resolvedMode,
        searchQuery,
        setSearchQuery,
        selectedThemeUrl,
        isDefaultThemeSelected,
        isLegacyGreenThemeSelected,
        isLoadingThemes,
        filteredThemes,
        customThemes,
        builtInThemes,
        maxImportedThemes,
        canImportTheme,
        handleThemeImported,
        handleThemeSelect,
        handleThemeDelete,
        toggleMode,
        resetToDefaultTheme,
        selectLegacyGreenTheme,
        randomizeTheme
    } = useThemeManagement()
    const defaultThemeColors = extractThemeColors(DEFAULT_THEME_PRESET, resolvedMode)
    const legacyGreenThemeColors = extractThemeColors(LEGACY_GREEN_THEME_PRESET, resolvedMode)
    const visibleCustomThemes =
        searchQuery || showAllImportedThemes
            ? customThemes
            : customThemes.slice(0, COLLAPSED_IMPORTED_THEME_COUNT)

    return (
        <>
            <ImportThemeDialog
                open={isImportDialogOpen}
                onOpenChange={setIsImportDialogOpen}
                onThemeImported={handleThemeImported}
                canImport={canImportTheme}
                maxImportedThemes={maxImportedThemes}
                nested={isMobile}
            />
            <div className="flex items-center gap-2">
                <Button
                    variant={buttonVariant}
                    size="icon"
                    className="size-8 rounded-md"
                    onClick={toggleMode}
                >
                    {themeState.currentMode === "system" ? (
                        <MonitorIcon className="size-3.5" />
                    ) : themeState.currentMode === "light" ? (
                        <SunIcon className="size-3.5" />
                    ) : (
                        <MoonIcon className="size-3.5" />
                    )}
                    <span className="sr-only">Cycle display mode</span>
                </Button>

                <ResponsivePopover modal={false}>
                    <ResponsivePopoverTrigger asChild>
                        <Button
                            variant={buttonVariant}
                            size="icon"
                            className="flex size-8 items-center rounded-md"
                        >
                            <PaintBucketIcon className="h-3.5 w-3.5" />
                        </Button>
                    </ResponsivePopoverTrigger>

                    <ResponsivePopoverContent
                        align="end"
                        className="flex h-[85dvh] min-h-0 w-full flex-col overflow-hidden p-0 md:h-auto md:max-h-[min(32rem,var(--radix-popover-content-available-height))] md:w-80"
                        title="Theme Selector"
                        description="Choose a theme for your interface"
                    >
                        {/* Note: Title and description are already in ResponsivePopoverContent */}
                        <Separator className="hidden md:block" />

                        {/* Search Input */}
                        <div
                            className={cn("px-4 pt-3 pb-3 md:p-2", !isMobile && "hidden md:block")}
                        >
                            <div className="relative">
                                <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground" />
                                <Input
                                    placeholder="Search themes..."
                                    className="h-9 rounded-none border-none bg-popover pl-10 shadow-none dark:bg-popover"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <Separator />

                        {/* Theme Count and Controls */}
                        <div className="flex items-center justify-between px-4 py-2 md:px-3">
                            <div className="text-muted-foreground text-sm">
                                {isLoadingThemes
                                    ? "Loading..."
                                    : `${filteredThemes.length + 1} themes`}
                            </div>
                            <div className="flex items-center gap-1">
                                {/* Randomizer */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    onClick={randomizeTheme}
                                    disabled={isLoadingThemes || filteredThemes.length === 0}
                                    title="Random theme"
                                >
                                    <ShuffleIcon className="h-3.5 w-3.5" />
                                    <span className="sr-only">Random theme</span>
                                </Button>

                                {/* Import Button */}
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        setIsImportDialogOpen(true)
                                    }}
                                    title={
                                        canImportTheme
                                            ? "Import theme"
                                            : `You can save up to ${maxImportedThemes} themes`
                                    }
                                >
                                    <PlusIcon className="h-3.5 w-3.5" />
                                    Import
                                </Button>
                            </div>
                        </div>
                        <Separator />

                        {/* Themes List */}
                        <div
                            className={cn(
                                "min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                                !isMobile &&
                                    "h-[clamp(12rem,calc(var(--radix-popover-content-available-height)-8.5rem),20rem)]"
                            )}
                        >
                            <div className="p-3">
                                {isLoadingThemes ? (
                                    <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                                        <LoaderIcon className="size-4 animate-spin" />
                                        Loading themes...
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-6">
                                            <h4 className="mb-1 text-muted-foreground text-xs">
                                                Core
                                            </h4>
                                            <div className="mt-1 grid grid-cols-1 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={resetToDefaultTheme}
                                                    className={cn(
                                                        "w-full cursor-pointer overflow-hidden rounded-lg border transition-all duration-200 hover:scale-[1.02] hover:shadow-md",
                                                        isDefaultThemeSelected
                                                            ? "border-primary shadow-sm ring-2 ring-primary/20"
                                                            : "border-border hover:border-primary/50"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between p-3">
                                                        <div className="text-left">
                                                            <div className="font-medium text-sm">
                                                                Default
                                                            </div>
                                                            <div className="text-muted-foreground text-xs">
                                                                Modern monochromatic theme
                                                            </div>
                                                        </div>
                                                        {isDefaultThemeSelected && (
                                                            <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                                                                <CheckCircle className="size-4 text-primary" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex h-2">
                                                        {defaultThemeColors.map((color, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex-1"
                                                                style={{
                                                                    backgroundColor: color
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={selectLegacyGreenTheme}
                                                    className={cn(
                                                        "w-full cursor-pointer overflow-hidden rounded-lg border transition-all duration-200 hover:scale-[1.02] hover:shadow-md",
                                                        isLegacyGreenThemeSelected
                                                            ? "border-primary shadow-sm ring-2 ring-primary/20"
                                                            : "border-border hover:border-primary/50"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between p-3">
                                                        <div className="text-left">
                                                            <div className="font-medium text-sm">
                                                                SilkChat Legacy
                                                            </div>
                                                            <div className="text-muted-foreground text-xs">
                                                                Our legacy green theme.
                                                            </div>
                                                        </div>
                                                        {isLegacyGreenThemeSelected && (
                                                            <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                                                                <CheckCircle className="size-4 text-primary" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex h-2">
                                                        {legacyGreenThemeColors.map(
                                                            (color, index) => (
                                                                <div
                                                                    key={index}
                                                                    className="flex-1"
                                                                    style={{
                                                                        backgroundColor: color
                                                                    }}
                                                                />
                                                            )
                                                        )}
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                        {customThemes.length > 0 && (
                                            <div className="mt-2 mb-6">
                                                <h4 className="mb-1 text-muted-foreground text-xs">
                                                    My Themes
                                                </h4>
                                                <div className="mt-1 grid grid-cols-1 gap-2">
                                                    {visibleCustomThemes.map((theme) => (
                                                        <ThemeButton
                                                            key={theme.url}
                                                            theme={theme}
                                                            isSelected={
                                                                selectedThemeUrl === theme.url
                                                            }
                                                            onSelect={handleThemeSelect}
                                                            onDelete={handleThemeDelete}
                                                            currentMode={resolvedMode}
                                                        />
                                                    ))}
                                                </div>
                                                {!searchQuery &&
                                                    customThemes.length >
                                                        COLLAPSED_IMPORTED_THEME_COUNT && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="mt-2 w-full text-xs"
                                                            onClick={() =>
                                                                setShowAllImportedThemes(
                                                                    (value) => !value
                                                                )
                                                            }
                                                        >
                                                            {showAllImportedThemes ? (
                                                                <ChevronUp className="size-3.5" />
                                                            ) : (
                                                                <ChevronDown className="size-3.5" />
                                                            )}
                                                            {showAllImportedThemes
                                                                ? "Show fewer"
                                                                : `View ${customThemes.length - COLLAPSED_IMPORTED_THEME_COUNT} more`}
                                                        </Button>
                                                    )}
                                            </div>
                                        )}
                                        <div className="mb-2">
                                            <h4 className="mb-1 text-muted-foreground text-xs">
                                                Built-in Themes
                                            </h4>
                                            <div className="mt-1 grid grid-cols-1 gap-2">
                                                {builtInThemes.map((theme) => (
                                                    <ThemeButton
                                                        key={theme.url}
                                                        theme={theme}
                                                        isSelected={selectedThemeUrl === theme.url}
                                                        onSelect={handleThemeSelect}
                                                        currentMode={resolvedMode}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </ResponsivePopoverContent>
                </ResponsivePopover>
            </div>
        </>
    )
}
