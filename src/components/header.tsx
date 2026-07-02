import { PrototypeCreditsQuickView } from "@/components/credits/prototype-credits"
import { useDesktopLibraryChromeStore } from "@/components/library/desktop-library-chrome-store"
import { usePrivateViewingStore } from "@/components/library/private-viewing-store"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSession } from "@/hooks/auth-hooks"
import { usePrototypeCredits } from "@/hooks/use-prototype-credits"
import { useHeaderActionsStore } from "@/lib/header-actions-store"
import {
    DEFAULT_LIBRARY_SEARCH,
    type LibraryView,
    validateLibrarySearch
} from "@/lib/library-search"
import { cn } from "@/lib/utils"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { Archive, ChevronLeft, Eye, EyeOff, Image as ImageIcon } from "lucide-react"
import { ThemeSwitcher } from "./themes/theme-switcher"
import { SidebarShortcutsHelper } from "./threads/sidebar-shortcuts-helper"
import { SidebarTrigger, useSidebar } from "./ui/sidebar"
import { UserButton } from "./user-button"

export function Header() {
    const { isMobile, openMobile, state: sidebarState } = useSidebar()
    const isMobileActionsCollapsed = useHeaderActionsStore((state) => state.isMobileCollapsed)
    const isDesktopActionsCollapsed = useHeaderActionsStore((state) => state.isDesktopCollapsed)
    const toggleActionsCollapsed = useHeaderActionsStore((state) => state.toggleCollapsed)
    const { data: session, isPending: isSessionPending } = useSession()
    const location = useLocation()
    const navigate = useNavigate()
    const isDesktopLibraryChromeCollapsed = useDesktopLibraryChromeStore(
        (state) => state.isCollapsed
    )
    const privateViewingEnabled = usePrivateViewingStore((state) => state.privateViewingEnabled)
    const togglePrivateViewingEnabled = usePrivateViewingStore(
        (state) => state.togglePrivateViewingEnabled
    )
    const shouldShowDevCreditPlanToggle = import.meta.env.DEV && Boolean(session?.user?.id)
    const {
        summary: prototypeCreditSummary,
        isLoading: isCreditsLoading,
        isRefreshing: isRefreshingCredits,
        isUpdatingCreditPlan,
        refreshCredits,
        setCreditPlan
    } = usePrototypeCredits({
        userId: session?.user?.id,
        isAuthLoading: isSessionPending
    })

    const showTrigger = isMobile ? !openMobile : true
    const isSidebarCollapsed = isMobile ? !openMobile : sidebarState === "collapsed"
    const isLibraryRoute = location.pathname.startsWith("/library")
    const librarySearch = isLibraryRoute
        ? validateLibrarySearch(location.search as Record<string, unknown>)
        : null
    const showDesktopLibraryControls =
        isLibraryRoute && !!session?.user?.id && !isMobile && librarySearch !== null
    const shouldCollapseHeader = showDesktopLibraryControls && isDesktopLibraryChromeCollapsed
    const areHeaderActionsVisible = isMobile
        ? !isMobileActionsCollapsed
        : !isDesktopActionsCollapsed

    const handleLibraryViewChange = (nextView: LibraryView) => {
        if (!librarySearch || nextView === librarySearch.view) return

        navigate({
            to: "/library",
            replace: true,
            search: {
                ...librarySearch,
                view: nextView,
                page: DEFAULT_LIBRARY_SEARCH.page
            }
        })
    }

    return (
        <>
            {showTrigger && (
                <div
                    className={cn(
                        "pointer-events-auto fixed z-50",
                        isSidebarCollapsed
                            ? "top-2 left-2 rounded-[var(--radius-xl)] bg-background/10 p-2 backdrop-blur-sm md:top-4 md:left-4"
                            : "top-4 left-4 md:top-6 md:left-6"
                    )}
                >
                    <SidebarTrigger className="h-8 w-8 text-muted-foreground transition-colors hover:text-foreground" />
                </div>
            )}
            <header
                className={cn(
                    "pointer-events-none absolute top-0 z-50 w-full transition-transform duration-300 ease-out",
                    shouldCollapseHeader ? "-translate-y-full" : "translate-y-0"
                )}
            >
                <div className="flex w-full items-center justify-end p-2">
                    <div className="pointer-events-auto flex items-center gap-2 rounded-[var(--radius-xl)] bg-background/10 p-2 backdrop-blur-sm">
                        {showDesktopLibraryControls && (
                            <>
                                <Tabs
                                    value={librarySearch.view}
                                    onValueChange={(value) =>
                                        handleLibraryViewChange(value as LibraryView)
                                    }
                                >
                                    <TabsList className="h-8">
                                        <TabsTrigger value="active" className="px-4 text-xs">
                                            <ImageIcon className="hidden h-3.5 w-3.5 lg:block" />
                                            Library
                                        </TabsTrigger>
                                        <TabsTrigger value="archived" className="px-4 text-xs">
                                            <Archive className="hidden h-3.5 w-3.5 lg:block" />
                                            Archive
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                                <Button
                                    type="button"
                                    variant={privateViewingEnabled ? "secondary" : "ghost"}
                                    size="sm"
                                    className="gap-2 text-xs"
                                    onClick={togglePrivateViewingEnabled}
                                >
                                    {privateViewingEnabled ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                    <span>Private Viewing</span>
                                </Button>
                                <div className="h-4 w-px bg-border" />
                            </>
                        )}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-[var(--radius-md)]"
                            onClick={() => toggleActionsCollapsed(isMobile ? "mobile" : "desktop")}
                            aria-expanded={areHeaderActionsVisible}
                            aria-label={
                                areHeaderActionsVisible
                                    ? "Hide header actions"
                                    : "Show header actions"
                            }
                        >
                            <ChevronLeft
                                className={cn(
                                    "h-4 w-4 transition-transform duration-300",
                                    areHeaderActionsVisible && "rotate-180"
                                )}
                            />
                        </Button>
                        <div
                            className={cn(
                                "flex items-center gap-2 overflow-hidden transition-all duration-300 ease-out",
                                areHeaderActionsVisible
                                    ? "max-w-72 opacity-100"
                                    : "-mr-2 invisible max-w-0 opacity-0"
                            )}
                            aria-hidden={!areHeaderActionsVisible}
                        >
                            {session?.user?.id && (
                                <PrototypeCreditsQuickView
                                    summary={prototypeCreditSummary}
                                    isLoading={isCreditsLoading}
                                    isRefreshing={isRefreshingCredits}
                                    shouldShowDevCreditPlanToggle={shouldShowDevCreditPlanToggle}
                                    isUpdatingCreditPlan={isUpdatingCreditPlan}
                                    onSetCreditPlan={setCreditPlan}
                                    onRefresh={refreshCredits}
                                    upgradeUrl="/settings/billing"
                                />
                            )}
                            {!isMobile && <SidebarShortcutsHelper />}
                            <ThemeSwitcher buttonVariant="ghost" />
                        </div>
                        <div className="h-4 w-px bg-border" />
                        <UserButton />
                    </div>
                </div>
            </header>
        </>
    )
}
