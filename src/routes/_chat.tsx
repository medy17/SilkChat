import {
    type ErrorComponentProps,
    createFileRoute,
    useLocation,
    useParams
} from "@tanstack/react-router"
import { AnimatePresence, motion } from "motion/react"
import { startTransition, useEffect, useMemo, useRef, useState } from "react"

import { Chat } from "@/components/chat"
import { ChatLoadingOverlay } from "@/components/chat-loading-overlay"
import { FolderChat } from "@/components/folder-chat"
import { Header } from "@/components/header"
import { LandingPage } from "@/components/landing-page"
import { LogoSymbol } from "@/components/logo"
import { MobileBranchGenerationOverlay } from "@/components/mobile-branch-generation-overlay"
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider"
import { SharedChat } from "@/components/shared-chat"
import {
    SPLASH_EXIT_DURATION_MS,
    SPLASH_FILL_DURATION_MS,
    SplashScreen
} from "@/components/splash-screen"
import { ThreadsSidebar } from "@/components/threads-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import type { Id } from "@/convex/_generated/dataModel"
import { useSession } from "@/hooks/auth-hooks"
import { useIsMobile } from "@/hooks/use-mobile"
import { useChatHydrationStore } from "@/lib/chat-hydration-store"
import { consumeSuppressedChatTransitionForPath } from "@/lib/chat-transition-override"
import {
    isRestorableChatPath,
    peekLastChatRoute,
    setLastChatRoute,
    setLastLibraryRoute
} from "@/lib/last-chat-route"
import {
    DEFAULT_LIBRARY_SEARCH,
    type LibrarySearchState,
    validateLibrarySearch
} from "@/lib/library-search"
import { captureBrowserException } from "@/lib/telemetry/browser"
import {
    normalizeThemeStoreStateForDefault,
    shouldMigrateToDefaultTheme,
    useThemeStore
} from "@/lib/theme-store"
import { cn } from "@/lib/utils"
import { LibraryView } from "./_chat.library"

export const Route = createFileRoute("/_chat")({
    component: ChatLayout
})

const ROOT_SESSION_LOADING_DELAY_MS = SPLASH_FILL_DURATION_MS
const ROOT_SESSION_EXIT_DELAY_MS = SPLASH_EXIT_DURATION_MS
const INITIAL_CHAT_SKELETON_HOLD_MS = 450
const INITIAL_CHAT_SKELETON_EXIT_MS = 250
const CHAT_TRANSITION_MIN_SPINNER_MS = 500
const CHAT_TRANSITION_SWAP_DELAY_MS = 180
// On mobile the sidebar sheet is still animating out (300ms) when a thread is picked.
// Hold the heavy content swap until the sheet has fully exited so the commit never
// competes with the exit animation, and keep the spinner up past the swap.
const MOBILE_CHAT_TRANSITION_MIN_SPINNER_MS = 700
const MOBILE_CHAT_TRANSITION_SWAP_DELAY_MS = 360
// Slightly longer than the fade-in's duration-300 so the class is removed only
// after the enter animation has finished.
const CHAT_CONTENT_ENTER_FADE_MS = 350
// Hard cap on how long the transition overlay may wait for hydration. Error
// states or views that never report settled must not strand the spinner.
const CHAT_TRANSITION_MAX_SPINNER_MS = 2000

const areStringArraysEqual = (left: string[], right: string[]) =>
    left.length === right.length && left.every((value, index) => value === right[index])

const areLibrarySearchStatesEqual = (left: LibrarySearchState, right: LibrarySearchState) =>
    left.page === right.page &&
    left.pageSize === right.pageSize &&
    left.query === right.query &&
    left.sort === right.sort &&
    left.view === right.view &&
    areStringArraysEqual(left.modelIds, right.modelIds) &&
    areStringArraysEqual(left.resolutions, right.resolutions) &&
    areStringArraysEqual(left.aspectRatios, right.aspectRatios) &&
    areStringArraysEqual(left.orientations, right.orientations)

type CachedChatTarget =
    | { kind: "root" }
    | { kind: "thread"; threadId: string }
    | { kind: "folder"; folderId: string }
    | { kind: "folderThread"; folderId: string; threadId: string }
    | { kind: "shared"; sharedThreadId: string }

const parseCachedChatTarget = (hrefOrPath: string): CachedChatTarget | null => {
    const pathname = new URL(hrefOrPath, "https://intern3.chat").pathname

    if (pathname === "/") {
        return { kind: "root" }
    }

    const threadMatch = /^\/thread\/([^/]+)$/.exec(pathname)
    if (threadMatch) {
        return {
            kind: "thread",
            threadId: threadMatch[1]
        }
    }

    const folderThreadMatch = /^\/folder\/([^/]+)\/thread\/([^/]+)$/.exec(pathname)
    if (folderThreadMatch) {
        return {
            kind: "folderThread",
            folderId: folderThreadMatch[1],
            threadId: folderThreadMatch[2]
        }
    }

    const folderMatch = /^\/folder\/([^/]+)$/.exec(pathname)
    if (folderMatch) {
        return {
            kind: "folder",
            folderId: folderMatch[1]
        }
    }

    const sharedMatch = /^\/s\/([^/]+)$/.exec(pathname)
    if (sharedMatch) {
        return {
            kind: "shared",
            sharedThreadId: sharedMatch[1]
        }
    }

    return null
}

const areCachedChatTargetsEqual = (
    left: CachedChatTarget | null,
    right: CachedChatTarget | null
) => {
    if (left === right) return true
    if (!left || !right || left.kind !== right.kind) return false

    switch (left.kind) {
        case "root":
            return true
        case "thread":
            return left.threadId === (right.kind === "thread" ? right.threadId : "")
        case "folder":
            return left.folderId === (right.kind === "folder" ? right.folderId : "")
        case "folderThread":
            return (
                right.kind === "folderThread" &&
                left.folderId === right.folderId &&
                left.threadId === right.threadId
            )
        case "shared":
            return left.sharedThreadId === (right.kind === "shared" ? right.sharedThreadId : "")
    }
}

// Mirrors the hydration key Chat publishes to useChatHydrationStore. Targets that
// don't render <Chat> (folder overview, shared threads) return null: no wait.
const getChatTargetHydrationKey = (target: CachedChatTarget | null) => {
    switch (target?.kind) {
        case "thread":
        case "folderThread":
            return target.threadId
        case "root":
            return "chat"
        default:
            return null
    }
}

const getCachedChatTargetKey = (target: CachedChatTarget | null) => {
    if (!target) return null

    switch (target.kind) {
        case "root":
            return "root"
        case "thread":
            return `thread:${target.threadId}`
        case "folder":
            return `folder:${target.folderId}`
        case "folderThread":
            return `folder-thread:${target.folderId}:${target.threadId}`
        case "shared":
            return `shared:${target.sharedThreadId}`
    }
}

function PersistentChatView({
    target,
    isActiveRoute
}: {
    target: CachedChatTarget
    isActiveRoute: boolean
}) {
    switch (target.kind) {
        case "root":
            return <Chat threadId={undefined} isActiveRoute={isActiveRoute} />
        case "thread":
            return <Chat threadId={target.threadId} isActiveRoute={isActiveRoute} />
        case "folder":
            return (
                <FolderChat
                    folderId={target.folderId as Id<"projects">}
                    isActiveRoute={isActiveRoute}
                />
            )
        case "folderThread":
            return (
                <Chat
                    threadId={target.threadId}
                    folderId={target.folderId as Id<"projects">}
                    isActiveRoute={isActiveRoute}
                />
            )
        case "shared":
            return <SharedChat sharedThreadId={target.sharedThreadId} />
    }
}

function ChatSkeletonBlock({ className }: { className: string }) {
    return (
        <Skeleton
            className={cn(
                "animate-[shimmer_1.15s_infinite_linear] bg-[linear-gradient(to_right,var(--muted)_25%,var(--accent)_50%,var(--muted)_75%)] bg-size-[200%_100%]",
                className
            )}
        />
    )
}

function ChatInitialSkeleton({ isExiting }: { isExiting: boolean }) {
    return (
        <motion.div
            initial={false}
            animate={{ opacity: isExiting ? 0 : 1 }}
            transition={{
                duration: INITIAL_CHAT_SKELETON_EXIT_MS / 1000,
                ease: [0.16, 1, 0.3, 1]
            }}
            aria-busy="true"
            aria-label="Loading chat"
            className="pointer-events-none absolute inset-0 isolate z-[60] overflow-hidden bg-background"
            style={{
                backgroundImage: "url(/noise.png)",
                backgroundRepeat: "repeat",
                backgroundSize: "auto"
            }}
        >
            <div
                aria-hidden="true"
                className="absolute top-2 right-2 flex h-12 items-center gap-2 rounded-[var(--radius-xl)] bg-background px-2"
            >
                <ChatSkeletonBlock className="size-8 rounded-[var(--radius-md)]" />
                <ChatSkeletonBlock className="hidden h-8 w-20 rounded-[var(--radius-md)] sm:block" />
                <ChatSkeletonBlock className="hidden size-8 rounded-[var(--radius-md)] sm:block" />
                <div className="h-4 w-px bg-border" />
                <ChatSkeletonBlock className="size-8 rounded-[var(--radius-xl)]" />
            </div>

            <div className="relative flex h-full items-center justify-center overflow-y-auto px-4 py-16">
                <div
                    aria-hidden="true"
                    className="flex w-full max-w-2xl flex-col items-center gap-5 [@media(min-height:820px)]:gap-7"
                >
                    <div className="relative size-24 sm:size-28 [@media(max-height:620px)]:size-14 [@media(min-height:820px)]:size-32">
                        <ChatSkeletonBlock className="absolute inset-0 rounded-[var(--radius-xl)]" />
                        <LogoSymbol className="absolute inset-1/4 size-1/2 text-muted-foreground/25" />
                    </div>

                    <div className="flex w-full flex-col items-center gap-2 [@media(max-height:480px)]:hidden">
                        <ChatSkeletonBlock className="h-8 w-64 max-w-[70vw] rounded-[var(--radius-md)]" />
                        <ChatSkeletonBlock className="h-4 w-36 rounded-[var(--radius-md)]" />
                    </div>

                    <div className="w-full px-1">
                        <div className="rounded-[var(--radius-lg)] border border-border/70 bg-composer p-3">
                            <div className="flex h-12 items-center px-1">
                                <ChatSkeletonBlock className="h-4 w-40 rounded-[var(--radius-md)]" />
                            </div>
                            <div className="flex h-10 items-center gap-2 pt-2">
                                <ChatSkeletonBlock className="h-8 w-28 rounded-[var(--radius-md)]" />
                                <ChatSkeletonBlock className="size-8 rounded-[var(--radius-md)]" />
                                <ChatSkeletonBlock className="size-8 rounded-[var(--radius-md)]" />
                                <ChatSkeletonBlock className="hidden size-8 rounded-[var(--radius-md)] sm:block" />
                                <div className="flex-1" />
                                <ChatSkeletonBlock className="size-8 rounded-[var(--radius-md)]" />
                            </div>
                        </div>

                        <div className="mt-3 flex flex-col gap-1 px-2">
                            {["w-36", "w-44", "w-40", "w-32"].map((width, index) => (
                                <div
                                    key={width}
                                    className="flex h-9 items-center gap-3 rounded-[var(--radius-md)] px-3"
                                >
                                    <ChatSkeletonBlock className="size-4 rounded-[var(--radius-sm)]" />
                                    <ChatSkeletonBlock
                                        className={`${width} h-3 rounded-[var(--radius-sm)]`}
                                    />
                                    {index === 0 ? (
                                        <ChatSkeletonBlock className="ml-auto hidden h-3 w-16 rounded-[var(--radius-sm)] sm:block" />
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

function ChatLayout() {
    const { data: session, isPending } = useSession()
    const params = useParams({ strict: false })
    const location = useLocation()
    const isMobile = useIsMobile()

    const isRoot = location.pathname === "/"
    const [shouldRunInitialRootAuthGate] = useState(isRoot)
    const [hasRootLoadingDelayElapsed, setHasRootLoadingDelayElapsed] = useState(!isRoot)
    const [hasCompletedInitialRootAuthGate, setHasCompletedInitialRootAuthGate] = useState(!isRoot)
    const [isRootLoaderExiting, setIsRootLoaderExiting] = useState(false)
    const [isInitialChatSkeletonExiting, setIsInitialChatSkeletonExiting] = useState(false)
    const [hasCompletedInitialChatSkeleton, setHasCompletedInitialChatSkeleton] = useState(!isRoot)
    const shouldShowInitialRootAuthGate =
        shouldRunInitialRootAuthGate && !hasCompletedInitialRootAuthGate
    const showRootSessionPendingState =
        isRoot && (shouldShowInitialRootAuthGate || (!shouldRunInitialRootAuthGate && isPending))
    const showLandingPage = isRoot && !showRootSessionPendingState && !session?.user
    const showInitialChatSkeleton =
        isRoot &&
        hasCompletedInitialRootAuthGate &&
        Boolean(session?.user) &&
        !hasCompletedInitialChatSkeleton

    const threadId = params.threadId
    const isLibraryRoute = location.pathname.startsWith("/library")
    const activeLibrarySearch = isLibraryRoute
        ? validateLibrarySearch(location.search as Record<string, unknown>)
        : undefined
    const currentChatTarget = useMemo(
        () => (isLibraryRoute ? null : parseCachedChatTarget(location.pathname)),
        [isLibraryRoute, location.pathname]
    )
    const [cachedLibrarySearch, setCachedLibrarySearch] =
        useState<LibrarySearchState>(DEFAULT_LIBRARY_SEARCH)
    const [hasMountedLibrary, setHasMountedLibrary] = useState(false)
    const [cachedChatTarget, setCachedChatTarget] = useState<CachedChatTarget | null>(() => {
        if (typeof window === "undefined") return null

        const storedRoute = peekLastChatRoute()
        return storedRoute ? parseCachedChatTarget(storedRoute) : null
    })
    const [displayedChatTarget, setDisplayedChatTarget] = useState<CachedChatTarget | null>(
        () => currentChatTarget ?? cachedChatTarget
    )
    const [isChatTransitionOverlayVisible, setIsChatTransitionOverlayVisible] = useState(false)
    const [hasChatTransitionMinSpinnerElapsed, setHasChatTransitionMinSpinnerElapsed] =
        useState(true)
    const [isChatContentEntering, setIsChatContentEntering] = useState(false)
    const [hasChatTransitionMaxWaitElapsed, setHasChatTransitionMaxWaitElapsed] = useState(false)
    const hydratedChatKey = useChatHydrationStore((state) => state.hydratedChatKey)
    // Once the Library/Chat cross-fade finishes, the losing pane is taken out of the render
    // budget with `content-visibility: hidden` (see below) and the Library grid defers its
    // heavy content until now. It starts settled so the initial inactive pane is skipped from
    // first paint.
    const [hasViewTransitionSettled, setHasViewTransitionSettled] = useState(true)
    const previousIsLibraryRouteRef = useRef(isLibraryRoute)
    const previousChatTargetKeyRef = useRef<string | null>(
        getCachedChatTargetKey(currentChatTarget)
    )
    const chatTransitionHideTimeoutRef = useRef<number | null>(null)
    const chatTransitionSwapTimeoutRef = useRef<number | null>(null)
    const chatTransitionMaxWaitTimeoutRef = useRef<number | null>(null)
    const hasLoadedLibraryGridRef = useRef(false)

    // Reset the settle flag synchronously when a toggle starts (render-phase, not an effect) so
    // the entering frame already defers the heavy pane instead of rendering it once and then
    // hiding it. Guarded by the ref so it runs only on an actual route change, never on mount.
    if (previousIsLibraryRouteRef.current !== isLibraryRoute) {
        previousIsLibraryRouteRef.current = isLibraryRoute
        setHasViewTransitionSettled(false)
    }

    useEffect(() => {
        if (!shouldRunInitialRootAuthGate) return

        const timeoutId = window.setTimeout(() => {
            setHasRootLoadingDelayElapsed(true)
        }, ROOT_SESSION_LOADING_DELAY_MS)

        return () => window.clearTimeout(timeoutId)
    }, [shouldRunInitialRootAuthGate])

    useEffect(() => {
        if (!showInitialChatSkeleton) return

        const exitTimeoutId = window.setTimeout(() => {
            setIsInitialChatSkeletonExiting(true)
        }, INITIAL_CHAT_SKELETON_HOLD_MS)
        const completeTimeoutId = window.setTimeout(() => {
            setHasCompletedInitialChatSkeleton(true)
        }, INITIAL_CHAT_SKELETON_HOLD_MS + INITIAL_CHAT_SKELETON_EXIT_MS)

        return () => {
            window.clearTimeout(exitTimeoutId)
            window.clearTimeout(completeTimeoutId)
        }
    }, [showInitialChatSkeleton])

    useEffect(() => {
        if (!shouldRunInitialRootAuthGate) return
        if (isPending || !hasRootLoadingDelayElapsed) return
        if (hasCompletedInitialRootAuthGate) return

        setIsRootLoaderExiting(true)

        const timeoutId = window.setTimeout(() => {
            setHasCompletedInitialRootAuthGate(true)
        }, ROOT_SESSION_EXIT_DELAY_MS)

        return () => window.clearTimeout(timeoutId)
    }, [
        hasCompletedInitialRootAuthGate,
        hasRootLoadingDelayElapsed,
        isPending,
        shouldRunInitialRootAuthGate
    ])

    useEffect(() => {
        if (!shouldRunInitialRootAuthGate) return
        if (isPending || session?.user) return

        const store = useThemeStore.getState()
        const persistedThemeState = {
            themeState: store.themeState,
            selectedThemeUrl: store.selectedThemeUrl
        }

        if (!shouldMigrateToDefaultTheme(persistedThemeState)) return

        const normalizedState = normalizeThemeStoreStateForDefault(persistedThemeState)
        if (!normalizedState.themeState) return

        store.setThemeState(normalizedState.themeState)
        store.setSelectedThemeUrl(normalizedState.selectedThemeUrl ?? null)
    }, [isPending, session?.user, shouldRunInitialRootAuthGate])

    useEffect(() => {
        if (!activeLibrarySearch) return
        setCachedLibrarySearch((previous) =>
            areLibrarySearchStatesEqual(previous, activeLibrarySearch)
                ? previous
                : activeLibrarySearch
        )
        setHasMountedLibrary(true)
    }, [activeLibrarySearch])

    useEffect(() => {
        if (isLibraryRoute) return

        const nextTarget = parseCachedChatTarget(location.pathname)
        if (!nextTarget) return

        setCachedChatTarget((previous) =>
            areCachedChatTargetsEqual(previous, nextTarget) ? previous : nextTarget
        )
    }, [isLibraryRoute, location.pathname])

    useEffect(() => {
        if (chatTransitionHideTimeoutRef.current !== null) {
            window.clearTimeout(chatTransitionHideTimeoutRef.current)
            chatTransitionHideTimeoutRef.current = null
        }

        if (chatTransitionSwapTimeoutRef.current !== null) {
            window.clearTimeout(chatTransitionSwapTimeoutRef.current)
            chatTransitionSwapTimeoutRef.current = null
        }

        if (chatTransitionMaxWaitTimeoutRef.current !== null) {
            window.clearTimeout(chatTransitionMaxWaitTimeoutRef.current)
            chatTransitionMaxWaitTimeoutRef.current = null
        }

        if (isLibraryRoute) {
            setIsChatTransitionOverlayVisible(false)
            return
        }

        const nextKey = getCachedChatTargetKey(currentChatTarget)
        const previousKey = previousChatTargetKeyRef.current
        previousChatTargetKeyRef.current = nextKey

        if (!nextKey || !previousKey || nextKey === previousKey) {
            setIsChatTransitionOverlayVisible(false)
            setDisplayedChatTarget((previous) =>
                areCachedChatTargetsEqual(previous, currentChatTarget)
                    ? previous
                    : currentChatTarget
            )
            return
        }

        if (consumeSuppressedChatTransitionForPath(location.pathname)) {
            setIsChatTransitionOverlayVisible(false)
            setDisplayedChatTarget((previous) =>
                areCachedChatTargetsEqual(previous, currentChatTarget)
                    ? previous
                    : currentChatTarget
            )
            return
        }

        setIsChatTransitionOverlayVisible(true)
        setHasChatTransitionMinSpinnerElapsed(false)
        setIsChatContentEntering(false)
        chatTransitionSwapTimeoutRef.current = window.setTimeout(
            () => {
                // Cached threads hydrate synchronously, which makes this commit heavy on
                // revisits. A transition lets React time-slice it instead of blocking the
                // spinner and any still-running exit animations.
                startTransition(() => {
                    setDisplayedChatTarget((previous) =>
                        areCachedChatTargetsEqual(previous, currentChatTarget)
                            ? previous
                            : currentChatTarget
                    )
                })
                chatTransitionSwapTimeoutRef.current = null
            },
            isMobile ? MOBILE_CHAT_TRANSITION_SWAP_DELAY_MS : CHAT_TRANSITION_SWAP_DELAY_MS
        )
        chatTransitionHideTimeoutRef.current = window.setTimeout(
            () => {
                setHasChatTransitionMinSpinnerElapsed(true)
                chatTransitionHideTimeoutRef.current = null
            },
            isMobile ? MOBILE_CHAT_TRANSITION_MIN_SPINNER_MS : CHAT_TRANSITION_MIN_SPINNER_MS
        )
        setHasChatTransitionMaxWaitElapsed(false)
        chatTransitionMaxWaitTimeoutRef.current = window.setTimeout(() => {
            setHasChatTransitionMaxWaitElapsed(true)
            chatTransitionMaxWaitTimeoutRef.current = null
        }, CHAT_TRANSITION_MAX_SPINNER_MS)

        return () => {
            if (chatTransitionHideTimeoutRef.current !== null) {
                window.clearTimeout(chatTransitionHideTimeoutRef.current)
                chatTransitionHideTimeoutRef.current = null
            }

            if (chatTransitionSwapTimeoutRef.current !== null) {
                window.clearTimeout(chatTransitionSwapTimeoutRef.current)
                chatTransitionSwapTimeoutRef.current = null
            }

            if (chatTransitionMaxWaitTimeoutRef.current !== null) {
                window.clearTimeout(chatTransitionMaxWaitTimeoutRef.current)
                chatTransitionMaxWaitTimeoutRef.current = null
            }
        }
    }, [currentChatTarget, isLibraryRoute, isMobile])

    // The overlay exits only once the minimum spinner time has passed, the new
    // thread has committed, AND its deferred message render has settled — so slow
    // markdown hydrations never flash stale or half-rendered content. The max-wait
    // cap dismisses unconditionally so a view that never settles can't strand it.
    useEffect(() => {
        if (!isChatTransitionOverlayVisible) return

        const expectedHydrationKey = getChatTargetHydrationKey(currentChatTarget)
        const isHydrationSettled =
            expectedHydrationKey === null || hydratedChatKey === expectedHydrationKey
        const isReady =
            hasChatTransitionMinSpinnerElapsed &&
            areCachedChatTargetsEqual(displayedChatTarget, currentChatTarget) &&
            isHydrationSettled

        if (!isReady && !hasChatTransitionMaxWaitElapsed) return

        setIsChatTransitionOverlayVisible(false)
        // The content fades in as the spinner fades out instead of appearing fully
        // formed the instant the overlay is gone.
        setIsChatContentEntering(true)
    }, [
        isChatTransitionOverlayVisible,
        hasChatTransitionMinSpinnerElapsed,
        hasChatTransitionMaxWaitElapsed,
        hydratedChatKey,
        displayedChatTarget,
        currentChatTarget
    ])

    useEffect(() => {
        if (!isChatContentEntering) return

        const timeoutId = window.setTimeout(() => {
            setIsChatContentEntering(false)
        }, CHAT_CONTENT_ENTER_FADE_MS)

        return () => window.clearTimeout(timeoutId)
    }, [isChatContentEntering])

    useEffect(() => {
        if (isLibraryRoute) {
            setLastLibraryRoute(location.href)
            return
        }

        if (!isRestorableChatPath(location.pathname)) return
        setLastChatRoute(location.href)
    }, [isLibraryRoute, location.href, location.pathname])

    if (showRootSessionPendingState) {
        return (
            <RootSessionPendingState
                isExiting={isRootLoaderExiting && shouldShowInitialRootAuthGate}
            />
        )
    }

    if (showLandingPage) {
        return <LandingPage />
    }

    const chatTargetToRender = displayedChatTarget ?? currentChatTarget ?? cachedChatTarget
    const isRenderedChatActiveRoute =
        !isLibraryRoute && areCachedChatTargetsEqual(chatTargetToRender, currentChatTarget)

    // Mobile is used as a proxy for low-end hardware: skip the cross-fade entirely and
    // hard-swap the panes. Both panes stay mounted, so an instant swap is essentially free
    // and avoids re-rasterizing the (image-heavy, backdrop-blurred) layers on weak GPUs.
    const viewTransition = isMobile
        ? { duration: 0 }
        : { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const }

    const handleViewTransitionComplete = () => setHasViewTransitionSettled(true)

    // Skip rendering the inactive pane while it's idle. Both panes stay mounted (instant swap,
    // preserved scroll/state) but the offscreen one is dropped from layout/paint/compositing,
    // which is what keeps the toggle cheap on content-heavy accounts.
    const libraryContentHidden = !isLibraryRoute && hasViewTransitionSettled
    const chatContentHidden = isLibraryRoute && hasViewTransitionSettled

    // Defer the grid to its skeletons through the *first* Library entrance so reconciliation
    // doesn't compete with the fade. Once mounted, the grid stays mounted (hidden via
    // content-visibility), so re-entering must not remount it — otherwise already-loaded images
    // visibly reload.
    if (isLibraryRoute && hasViewTransitionSettled) {
        hasLoadedLibraryGridRef.current = true
    }
    const deferLibraryHeavyContent =
        isLibraryRoute && !hasViewTransitionSettled && !hasLoadedLibraryGridRef.current

    return (
        <OnboardingProvider>
            <SidebarProvider>
                <ThreadsSidebar />
                <SidebarInset>
                    <div
                        className="relative flex min-h-svh flex-1 flex-col overflow-hidden"
                        style={{
                            backgroundImage: "url(/noise.png)",
                            backgroundRepeat: "repeat",
                            backgroundSize: "auto"
                        }}
                    >
                        <Header />
                        <div className="relative flex min-h-0 flex-1 flex-col">
                            {hasMountedLibrary || isLibraryRoute ? (
                                <motion.div
                                    initial={false}
                                    animate={{
                                        opacity: isLibraryRoute ? 1 : 0,
                                        y: isLibraryRoute ? 0 : 18
                                    }}
                                    transition={viewTransition}
                                    onAnimationComplete={handleViewTransitionComplete}
                                    aria-hidden={!isLibraryRoute}
                                    className="absolute inset-0 min-h-0 overflow-hidden"
                                    style={{
                                        pointerEvents: isLibraryRoute ? "auto" : "none",
                                        contentVisibility: libraryContentHidden
                                            ? "hidden"
                                            : "visible"
                                    }}
                                >
                                    <LibraryView
                                        search={activeLibrarySearch ?? cachedLibrarySearch}
                                        deferHeavyContent={deferLibraryHeavyContent}
                                    />
                                </motion.div>
                            ) : null}
                            {chatTargetToRender ? (
                                <motion.div
                                    initial={false}
                                    animate={{
                                        opacity: isLibraryRoute ? 0 : 1,
                                        y: isLibraryRoute ? 18 : 0
                                    }}
                                    transition={viewTransition}
                                    onAnimationComplete={handleViewTransitionComplete}
                                    aria-hidden={isLibraryRoute}
                                    className="absolute inset-0 flex min-h-0 flex-1 flex-col overflow-hidden"
                                    style={{
                                        pointerEvents: isLibraryRoute ? "none" : "auto",
                                        contentVisibility: chatContentHidden ? "hidden" : "visible"
                                    }}
                                >
                                    <div
                                        className={cn(
                                            "flex min-h-0 flex-1 flex-col",
                                            isChatContentEntering &&
                                                "fade-in-0 animate-in duration-300"
                                        )}
                                    >
                                        <PersistentChatView
                                            target={chatTargetToRender}
                                            isActiveRoute={isRenderedChatActiveRoute}
                                        />
                                    </div>
                                </motion.div>
                            ) : null}
                            <AnimatePresence>
                                {isChatTransitionOverlayVisible && !isLibraryRoute ? (
                                    <ChatLoadingOverlay
                                        key="chat-route-transition"
                                        label="Loading conversation"
                                    />
                                ) : null}
                            </AnimatePresence>
                            {!isLibraryRoute ? <MobileBranchGenerationOverlay /> : null}
                        </div>
                        <AnimatePresence>
                            {showInitialChatSkeleton ? (
                                <ChatInitialSkeleton
                                    key="initial-chat-skeleton"
                                    isExiting={isInitialChatSkeletonExiting}
                                />
                            ) : null}
                        </AnimatePresence>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </OnboardingProvider>
    )
}

function RootSessionPendingState({ isExiting }: { isExiting: boolean }) {
    return <SplashScreen isExiting={isExiting} label="Loading session" />
}

export const ChatErrorBoundary = ({ error, info, reset }: ErrorComponentProps) => {
    const isNotFound = error.message.includes("ArgumentValidationError")

    useEffect(() => {
        if (isNotFound) return
        captureBrowserException(error, {
            surface: "chat_route",
            component_stack_available: Boolean(info?.componentStack)
        })
    }, [error, info?.componentStack, isNotFound])

    return (
        <div className="relative flex h-[calc(100dvh-var(--app-header-height))] flex-col items-center justify-center">
            <div className="text-center">
                {isNotFound ? (
                    <>
                        <h1 className="mb-4 font-bold text-4xl text-muted-foreground">404</h1>
                        <p className="mb-6 text-lg text-muted-foreground">Thread not found</p>
                        <p className="text-muted-foreground text-sm">
                            The thread you're looking for doesn't exist or has been deleted.
                        </p>
                    </>
                ) : (
                    <>
                        <h1 className="mb-4 font-bold text-2xl text-muted-foreground">
                            Something went wrong
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            An error occurred while loading this page.
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}
