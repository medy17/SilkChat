import { PrototypeCreditsQuickView } from "@/components/credits/prototype-credits"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSession } from "@/hooks/auth-hooks"
import { usePrototypeCredits } from "@/hooks/use-prototype-credits"
import { useShowContextualDevTools } from "@/lib/dev-tools"
import { useHeaderActionsStore } from "@/lib/header-actions-store"
import { isNewChatPath } from "@/lib/last-chat-route"
import {
    DEFAULT_LIBRARY_SEARCH,
    type LibraryView,
    validateLibrarySearch
} from "@/lib/library-search"
import { cn } from "@/lib/utils"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { Archive, ChevronLeft, Image as ImageIcon, Plus } from "lucide-react"
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
    const showContextualDevTools = useShowContextualDevTools()
    const shouldShowDevCreditPlanToggle = showContextualDevTools && Boolean(session?.user?.id)
    const {
        summary: prototypeCreditSummary,
        isLoading: isCreditsLoading,
        isRefreshing: isRefreshingCredits,
        devCreditState,
        isUpdatingDevCreditState,
        refreshCredits,
        setDevCreditState
    } = usePrototypeCredits({
        userId: session?.user?.id,
        isAuthLoading: isSessionPending,
        enableDevCreditState: shouldShowDevCreditPlanToggle
    })

    const showTrigger = isMobile ? !openMobile : true
    const isSidebarCollapsed = isMobile ? !openMobile : sidebarState === "collapsed"
    const isLibraryRoute = location.pathname.startsWith("/library")
    const isNewChat = isNewChatPath(location.pathname)
    const librarySearch = isLibraryRoute
        ? validateLibrarySearch(location.search as Record<string, unknown>)
        : null
    const showDesktopLibraryControls =
        isLibraryRoute && !!session?.user?.id && !isMobile && librarySearch !== null
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

    const handleNewChat = () => {
        if (isNewChat) return

        document.dispatchEvent(new CustomEvent("new_chat"))
        void navigate({ to: "/" })
    }

    return (
        <>
            {showTrigger && (
                <>
                    <div
                        className={cn(
                            "pointer-events-auto fixed z-[5] flex items-center gap-1",
                            isSidebarCollapsed
                                ? "top-2 left-2 rounded-[var(--radius-xl)] bg-background/10 p-2 backdrop-blur-sm md:top-4 md:left-4"
                                : "top-4 left-4 md:top-6 md:left-6"
                        )}
                    >
                        <div className="h-8 w-8" aria-hidden="true" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="inline-flex" aria-hidden={!isSidebarCollapsed}>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground transition-colors hover:text-foreground"
                                        onClick={handleNewChat}
                                        disabled={isNewChat || !isSidebarCollapsed}
                                        aria-label="New chat"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={4}>
                                New chat
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <SidebarTrigger className="pointer-events-auto fixed top-4 left-4 z-50 h-8 w-8 text-muted-foreground transition-colors hover:text-foreground md:top-6 md:left-6" />
                </>
            )}
            <header className="pointer-events-none absolute top-0 z-50 w-full">
                <div className="flex w-full items-center justify-end p-2">
                    <div
                        data-app-header-controls
                        className="pointer-events-auto flex items-center gap-2 rounded-[var(--radius-xl)] bg-background/10 p-2 backdrop-blur-sm"
                    >
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
                                    : "invisible -mr-2 max-w-0 opacity-0"
                            )}
                            aria-hidden={!areHeaderActionsVisible}
                        >
                            {session?.user?.id && (
                                <PrototypeCreditsQuickView
                                    summary={prototypeCreditSummary}
                                    isLoading={isCreditsLoading}
                                    isRefreshing={isRefreshingCredits}
                                    shouldShowDevCreditPlanToggle={shouldShowDevCreditPlanToggle}
                                    devCreditState={devCreditState}
                                    isUpdatingDevCreditState={isUpdatingDevCreditState}
                                    onSetDevCreditState={setDevCreditState}
                                    onRefresh={refreshCredits}
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
