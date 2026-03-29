import { ShareButton } from "./share-button"
import { ThemeSwitcher } from "./themes/theme-switcher"
import { ThreadExportButton } from "./thread-export-button"
import { SidebarTrigger, useSidebar } from "./ui/sidebar"
import { UserButton } from "./user-button"

export function Header({ threadId }: { threadId?: string }) {
    const { isMobile, openMobile } = useSidebar()

    const showTrigger = isMobile ? !openMobile : true

    return (
        <>
            {showTrigger && (
                <div className="pointer-events-auto fixed top-4 left-4 z-50 md:top-6 md:left-6">
                    <SidebarTrigger className="h-8 w-8 text-muted-foreground transition-colors hover:text-foreground" />
                </div>
            )}
            <header className="pointer-events-none absolute top-0 z-50 w-full">
                <div className="flex w-full items-center justify-end p-2">
                    <div className="pointer-events-auto flex items-center space-x-2 rounded-xl bg-background/10 p-2 backdrop-blur-sm">
                        {threadId && <ThreadExportButton threadId={threadId} />}
                        {threadId && <ShareButton threadId={threadId} />}
                        <ThemeSwitcher />
                        <div className="h-4 w-px bg-border" />
                        <UserButton />
                    </div>
                </div>
            </header>
        </>
    )
}
