import { PrototypeCreditsQuickView } from "@/components/credits/prototype-credits"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSession } from "@/hooks/auth-hooks"
import { useShowContextualDevTools } from "@/lib/dev-tools"
import { useHeaderActionsStore } from "@/lib/header-actions-store"
import { useHeaderToolbarSlotStore } from "@/lib/header-toolbar-slot"
import { isNewChatPath } from "@/lib/last-chat-route"
import { cn } from "@/lib/utils"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { ChevronLeft, Plus } from "lucide-react"
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

    const showTrigger = isMobile ? !openMobile : true
    const isSidebarCollapsed = isMobile ? !openMobile : sidebarState === "collapsed"
    const isLibraryRoute = location.pathname.startsWith("/library")
    const isNewChat = isNewChatPath(location.pathname)
    const setToolbarSlot = useHeaderToolbarSlotStore((state) => state.setElement)
    // The library portals its search, filters, and view controls into the bar.
    const hasPageToolbar = isLibraryRoute && !!session?.user?.id && !isMobile
    // Set by the page while scrolling down; the bar and the collapsed cluster slide away together.
    const isPageToolbarHidden =
        useHeaderToolbarSlotStore((state) => state.isHidden) && hasPageToolbar
    const slideAwayClass = cn(
        "transition-transform duration-300 ease-out motion-reduce:transition-none",
        isPageToolbarHidden && "-translate-y-[calc(100%+1.5rem)]"
    )
    const areHeaderActionsVisible = isMobile
        ? !isMobileActionsCollapsed
        : !isDesktopActionsCollapsed

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
                                ? cn(
                                      "glass-surface top-2 left-2 rounded-[var(--radius-xl)] border p-2 md:top-4 md:left-4",
                                      slideAwayClass
                                  )
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
                    <SidebarTrigger
                        className={cn(
                            "pointer-events-auto fixed top-4 left-4 z-50 h-8 w-8 text-muted-foreground transition-colors hover:text-foreground md:top-6 md:left-6",
                            isSidebarCollapsed && slideAwayClass
                        )}
                    />
                </>
            )}
            <header
                className={cn("pointer-events-none absolute top-0 z-50 w-full", slideAwayClass)}
            >
                <div className="flex w-full items-center justify-end p-2">
                    <div
                        className={cn(
                            "glass-surface pointer-events-auto flex items-center gap-2 rounded-[var(--radius-xl)] border p-2",
                            // Clears the collapsed sidebar cluster, which is fixed to the viewport
                            // (16px + 84px wide + 8px gap) while the header sits inside the
                            // inset's 8px margin plus its own 8px padding.
                            hasPageToolbar &&
                                cn(
                                    // Same timing as the sidebar's width transition, so the
                                    // left edge glides with it instead of jumping first.
                                    "@container/app-header-bar min-w-0 flex-1 transition-[margin-left] duration-200 ease-linear",
                                    isSidebarCollapsed && "ml-[92px]"
                                )
                        )}
                    >
                        {hasPageToolbar && (
                            <>
                                <div
                                    ref={setToolbarSlot}
                                    className="flex min-w-0 flex-1 items-center gap-2"
                                />
                                <div className="@3xl/app-header-bar:block hidden h-4 w-px shrink-0 bg-border" />
                            </>
                        )}
                        {/* A narrow page toolbar keeps the bar to one row by dropping these. */}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "size-8 rounded-[var(--radius-md)]",
                                hasPageToolbar && "@3xl/app-header-bar:inline-flex hidden"
                            )}
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
                                hasPageToolbar && "@3xl/app-header-bar:flex hidden",
                                areHeaderActionsVisible
                                    ? "max-w-72 opacity-100"
                                    : "invisible -mr-2 max-w-0 opacity-0"
                            )}
                            aria-hidden={!areHeaderActionsVisible}
                        >
                            {session?.user?.id && (
                                <PrototypeCreditsQuickView
                                    userId={session.user.id}
                                    isAuthLoading={isSessionPending}
                                    enabled={areHeaderActionsVisible}
                                    shouldShowDevCreditPlanToggle={shouldShowDevCreditPlanToggle}
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
