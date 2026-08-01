import { Button, buttonVariants } from "@/components/ui/button"
import { SidebarHeader, SidebarTrigger } from "@/components/ui/sidebar"
import { api } from "@/convex/_generated/api"
import { getLastChatRoute, getLastLibraryRoute } from "@/lib/last-chat-route"
import { DEFAULT_LIBRARY_SEARCH } from "@/lib/library-search"
import { cn } from "@/lib/utils"
import { Link, useNavigate } from "@tanstack/react-router"
import { useConvex } from "convex/react"
import { Image as ImageIcon, MessageSquare, Search, SquarePen } from "lucide-react"
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

    return (
        <SidebarHeader>
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
    )
}
