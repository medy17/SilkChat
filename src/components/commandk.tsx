"use client"

import { useRouter } from "@tanstack/react-router"
import { useQuery as useConvexQuery } from "convex-helpers/react/cache"
import { useEffect, useMemo, useRef, useState } from "react"

import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { useIsTouchDevice } from "@/hooks/use-touch-device"
import { matchesSearchChatsShortcut } from "@/lib/keyboard-shortcuts"
import { cn } from "@/lib/utils"

interface Thread {
    _id: string
    title: string
    createdAt: number
    updatedAt: number
    authorId: string
}

const SKELETON_TITLE_WIDTHS = ["w-48", "w-64", "w-40", "w-56", "w-44"]

function CommandKSkeleton() {
    return (
        <div role="status" aria-busy="true" className="p-1">
            <span className="sr-only">Loading chats</span>
            <div aria-hidden="true">
                <div className="px-2 py-1.5">
                    <Skeleton className="h-3 w-12" />
                </div>
                {SKELETON_TITLE_WIDTHS.map((width) => (
                    <div key={width} className="flex h-9 items-center justify-between gap-4 px-2">
                        <Skeleton className={`h-4 max-w-[70%] ${width}`} />
                        <Skeleton className="h-3 w-10 shrink-0" />
                    </div>
                ))}
            </div>
        </div>
    )
}

interface CommandKProps {
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function CommandK({ open: controlledOpen, onOpenChange }: CommandKProps = {}) {
    const [internalOpen, setInternalOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    const { data: session } = useSession()
    const router = useRouter()
    const commandRef = useRef<HTMLDivElement>(null)
    const isTouchDevice = useIsTouchDevice()

    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = isControlled ? onOpenChange || (() => {}) : setInternalOpen

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query)
        }, 300)

        return () => clearTimeout(timer)
    }, [query])

    const searchResults = useConvexQuery(
        api.threads.searchUserThreads,
        open && session?.user?.id
            ? {
                  query: debouncedQuery,
                  paginationOpts: { numItems: 10, cursor: null }
              }
            : "skip"
    )

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (!matchesSearchChatsShortcut(e)) {
                return
            }

            e.preventDefault()
            setOpen(!open)
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [open, setOpen])

    const loadedThreads = useMemo(() => {
        if (!searchResults) return undefined
        if ("error" in searchResults) return []
        return (searchResults.page || []) as Thread[]
    }, [searchResults])

    // Keep the last settled results on screen while a new query loads.
    const lastThreadsRef = useRef<Thread[] | null>(null)
    if (loadedThreads) lastThreadsRef.current = loadedThreads
    const threads = loadedThreads ?? lastThreadsRef.current
    const isPending = query !== debouncedQuery || loadedThreads === undefined
    const showSkeleton = threads === null || (threads.length === 0 && isPending)
    const showEmpty = !showSkeleton && threads.length === 0

    const handleSelect = (threadId: string) => {
        setOpen(false)
        setQuery("")
        setDebouncedQuery("")
        router.navigate({ to: "/thread/$threadId", params: { threadId } })
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && query.trim() === "") {
            const selectedItem = commandRef.current?.querySelector('[data-selected="true"]')
            if (selectedItem) {
                return
            }
            e.preventDefault()
            setOpen(false)
            setQuery("")
            setDebouncedQuery("")
            router.navigate({ to: "/" })
        }
    }

    const formatRelativeTime = (timestamp: number) => {
        try {
            const now = new Date()
            const date = new Date(timestamp)
            const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

            if (seconds < 5) {
                return "just now"
            }
            if (seconds < 60) {
                return `${seconds}s ago`
            }

            const minutes = Math.floor(seconds / 60)
            if (minutes < 60) {
                return `${minutes}m ago`
            }

            const hours = Math.floor(minutes / 60)
            if (hours < 24) {
                return `${hours}h ago`
            }

            const days = Math.floor(hours / 24)
            if (days < 30) {
                return `${days}d ago`
            }

            const months = Math.floor(days / 30)
            if (months < 12) {
                return `${months}mo ago`
            }

            const years = Math.floor(days / 365)
            return `${years}y ago`
        } catch {
            return null
        }
    }

    if (!session?.user?.id) {
        return null
    }

    return (
        <CommandDialog open={open} onOpenChange={setOpen} className="top-[30%] translate-y-0">
            <Command ref={commandRef} shouldFilter={false} disablePointerSelection value={"-"}>
                <CommandInput
                    autoFocus={!isTouchDevice}
                    placeholder="Search chats or press Enter to start a new chat..."
                    value={query}
                    onValueChange={setQuery}
                    onKeyDown={handleKeyDown}
                />
                <CommandList aria-busy={isPending}>
                    {showSkeleton && <CommandKSkeleton />}
                    {showEmpty && <CommandEmpty>No chats found.</CommandEmpty>}
                    {threads && threads.length > 0 && (
                        <CommandGroup
                            heading="Chats"
                            className={cn(
                                "transition-opacity duration-150",
                                isPending && "opacity-60"
                            )}
                        >
                            {threads.map((thread) => (
                                <CommandItem
                                    key={thread._id}
                                    value={thread._id}
                                    onSelect={() => handleSelect(thread._id)}
                                    className="h-9 hover:bg-accent/80"
                                >
                                    <div className="flex w-full items-center justify-between gap-4">
                                        <div className="flex min-w-0 flex-1 items-center gap-2">
                                            <div className="truncate font-medium">
                                                {thread.title}
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 text-muted-foreground text-xs">
                                            {formatRelativeTime(
                                                thread.updatedAt ?? thread.createdAt
                                            )}
                                        </div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}
                </CommandList>
            </Command>
        </CommandDialog>
    )
}
