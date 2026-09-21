import { Button, buttonVariants } from "@/components/ui/button"
import { SidebarHeader, SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api } from "@/convex/_generated/api"
import { getLastChatRoute, getLastLibraryRoute } from "@/lib/last-chat-route"
import { DEFAULT_LIBRARY_SEARCH } from "@/lib/library-search"
import { cn } from "@/lib/utils"
import { Link, useNavigate } from "@tanstack/react-router"
import { useConvex } from "convex/react"
import { FileUp, Image as ImageIcon, MessageSquare, Search, SquarePen } from "lucide-react"
import { type MouseEvent, useRef } from "react"
import { LibraryLogo, LogoMark } from "../logo"
import { ImportThreadButton } from "./import-thread-button"

export function ThreadsSidebarHeader({
    onNewChat,
    onImportClick,
    onSearchClick,
    isLibraryMode
}: {
    onNewChat: (event: MouseEvent<HTMLAnchorElement>) => void
    onImportClick: () => void
    onSearchClick: () => void
    isLibraryMode?: boolean
}) {
    const navigate = useNavigate()
    const { isMobile, state } = useSidebar()
    const convex = useConvex()
    const hasPrefetchedLibraryRef = useRef(false)

    const handleToggleHover = () => {
        if (isLibraryMode || hasPrefetchedLibraryRef.current) return
        hasPrefetchedLibraryRef.current = true

        // The Library remains safe to warm because it does not fetch thread data.
        convex
            .query(api.images.paginateGeneratedImages, {
                paginationOpts: {
                    numItems: DEFAULT_LIBRARY_SEARCH.pageSize,
                    cursor: null
                },
                query: DEFAULT_LIBRARY_SEARCH.query,
                sortBy: DEFAULT_LIBRARY_SEARCH.sort,
                view: DEFAULT_LIBRARY_SEARCH.view
            })
            .catch(() => {})
    }

    const handleLibraryToggle = () => {
        if (isLibraryMode) {
            navigate({ href: getLastChatRoute() })
            return
        }

        navigate({ href: getLastLibraryRoute() })
    }

    const isCollapsed = !isMobile && state === "collapsed"
    const collapsedHeader = !isMobile && (
        <SidebarHeader
            inert={!isCollapsed}
            aria-hidden={!isCollapsed}
            className={cn(
                "absolute top-0 left-0 w-[calc(var(--sidebar-width-icon)-(--spacing(4)))] shrink-0 items-center self-start px-0 transition-opacity duration-150 motion-reduce:transition-none",
                isCollapsed
                    ? "opacity-100 ease-[steps(1,start)]"
                    : "pointer-events-none opacity-0 ease-[steps(1,end)]"
            )}
        >
            <div className="flex justify-center pt-2">
                <div className="size-8" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
                <div className="my-2 h-px shrink-0" />
                <div className="flex flex-col items-center gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link
                                to="/"
                                onClick={onNewChat}
                                aria-label="New chat"
                                className={cn(
                                    buttonVariants({ variant: "ghost", size: "icon" }),
                                    "size-9 text-sidebar-foreground"
                                )}
                            >
                                <SquarePen className="size-4" />
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right">New chat</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-9 text-sidebar-foreground"
                                onClick={onImportClick}
                                aria-label="Import Thread"
                            >
                                <FileUp className="size-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Import Thread</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-9 text-sidebar-foreground"
                                onClick={onSearchClick}
                                aria-label="Search chats"
                            >
                                <Search className="size-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Search chats</TooltipContent>
                    </Tooltip>
                </div>
            </div>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-sidebar-foreground"
                        onClick={handleLibraryToggle}
                        onMouseEnter={handleToggleHover}
                        aria-label={isLibraryMode ? "Back to chat" : "Image library"}
                    >
                        {isLibraryMode ? (
                            <MessageSquare className="size-4" />
                        ) : (
                            <ImageIcon className="size-4" />
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                    {isLibraryMode ? "Back to chat" : "Image library"}
                </TooltipContent>
            </Tooltip>
        </SidebarHeader>
    )

    return (
        <>
            {collapsedHeader}
            <SidebarHeader
                inert={isCollapsed}
                aria-hidden={isCollapsed}
                className={cn(
                    "relative z-10 bg-sidebar transition-opacity duration-150 ease-linear motion-reduce:transition-none md:w-[calc(var(--sidebar-width)-(--spacing(4)))] md:shrink-0 md:px-0",
                    isCollapsed ? "pointer-events-none opacity-0" : "opacity-100"
                )}
            >
                <div className="flex w-full items-center justify-between px-2 pt-2">
                    <SidebarTrigger className="h-8 w-8 text-muted-foreground transition-colors hover:text-foreground md:hidden" />
                    <div className="hidden h-8 w-8 shrink-0 md:block" />

                    <Link
                        to="/"
                        className="-my-1 flex h-[28px] items-start overflow-hidden py-1"
                        style={{
                            maskImage:
                                "linear-gradient(to bottom, transparent 0px, black 4px, black 24px, transparent 28px)",
                            WebkitMaskImage:
                                "linear-gradient(to bottom, transparent 0px, black 4px, black 24px, transparent 28px)"
                        }}
                    >
                        <div
                            className={cn(
                                "flex flex-col items-center gap-2 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                                isLibraryMode ? "-translate-y-[28px]" : "translate-y-0"
                            )}
                        >
                            <LogoMark className="h-5 w-auto shrink-0" />
                            <LibraryLogo className="h-5 w-auto shrink-0" />
                        </div>
                    </Link>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleLibraryToggle}
                        onMouseEnter={handleToggleHover}
                        className="h-8 w-8 text-muted-foreground transition-colors hover:text-foreground"
                    >
                        {isLibraryMode ? (
                            <MessageSquare className="h-4 w-4" />
                        ) : (
                            <ImageIcon className="h-4 w-4" />
                        )}
                    </Button>
                </div>

                <div
                    className={cn(
                        "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                        isLibraryMode ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
                    )}
                >
                    <div className="pointer-events-none flex flex-col overflow-hidden [&>*]:pointer-events-auto">
                        <div className="my-2 h-px w-full shrink-0" />

                        <div className="flex flex-col gap-1">
                            <Link
                                to="/"
                                onClick={onNewChat}
                                className={cn(
                                    buttonVariants({ variant: "ghost" }),
                                    "h-9 w-full justify-start gap-2 px-2 font-normal text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                )}
                                style={{ borderRadius: "var(--radius-lg)" }}
                                tabIndex={isLibraryMode ? -1 : 0}
                            >
                                <SquarePen className="size-4 shrink-0" />
                                <span>New Chat</span>
                            </Link>

                            <div
                                className={cn(
                                    "transition-opacity",
                                    isLibraryMode ? "pointer-events-none" : "pointer-events-auto"
                                )}
                            >
                                <ImportThreadButton onClick={onImportClick} />
                            </div>

                            <Button
                                onClick={onSearchClick}
                                variant="ghost"
                                className="h-9 w-full justify-start gap-2 px-2 font-normal text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                style={{ borderRadius: "var(--radius-lg)" }}
                                tabIndex={isLibraryMode ? -1 : 0}
                            >
                                <Search className="size-4 shrink-0" />
                                <span>Search chats</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </SidebarHeader>
        </>
    )
}
