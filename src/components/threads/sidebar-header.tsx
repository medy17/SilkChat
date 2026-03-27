import { Button, buttonVariants } from "@/components/ui/button"
import { SidebarHeader } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { Link } from "@tanstack/react-router"
import { Search } from "lucide-react"
import type { MouseEvent } from "react"
import { LogoMark } from "../logo"
import { ImportThreadButton } from "./import-thread-button"

export function ThreadsSidebarHeader({
    primaryShortcutLabel,
    onNewChat,
    onImportClick,
    onSearchClick
}: {
    primaryShortcutLabel: string
    onNewChat: (event: MouseEvent<HTMLAnchorElement>) => void
    onImportClick: () => void
    onSearchClick: () => void
}) {
    return (
        <SidebarHeader>
            <div className="flex w-full items-center justify-center gap-2">
                <Link to="/">
                    <LogoMark className="h-auto w-full max-w-52 px-4 pt-1.5" />
                </Link>
            </div>
            <div className="my-2 h-px w-full bg-border" />

            <Link
                to="/"
                onClick={onNewChat}
                className={cn(buttonVariants({ variant: "default" }), "w-full justify-center")}
            >
                New Chat
            </Link>

            <ImportThreadButton onClick={onImportClick} />

            <Button onClick={onSearchClick} variant="outline">
                <Search className="h-4 w-4" />
                Search chats
                <div className="ml-auto flex items-center gap-1 text-xs">
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium font-mono text-muted-foreground">
                        <span className="text-sm">{primaryShortcutLabel}</span>
                        <span className="text-xs">K</span>
                    </kbd>
                </div>
            </Button>
        </SidebarHeader>
    )
}
