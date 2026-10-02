import {
    type ErrorComponentProps,
    createFileRoute,
    useLocation,
    useParams
} from "@tanstack/react-router"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { startTransition, useEffect, useMemo, useRef, useState } from "react"

import { Chat } from "@/components/chat"
import { FolderChat } from "@/components/folder-chat"
import { Header } from "@/components/header"
import { LandingPage } from "@/components/landing-page"
import { LogoSymbol } from "@/components/logo"
import { MobileBranchGenerationOverlay } from "@/components/mobile-branch-generation-overlay"
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider"
import { PROMPT_TEXTAREA_CLASS } from "@/components/prompt-kit/prompt-input"
import { SharedChat } from "@/components/shared-chat"
import {
    SPLASH_EXIT_DURATION_MS,
    SPLASH_FILL_DURATION_MS,
    SplashScreen
} from "@/components/splash-screen"
import { ThreadsSidebar } from "@/components/threads-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { Id } from "@/convex/_generated/dataModel"
import { useSession } from "@/hooks/auth-hooks"
import { useIsMobile } from "@/hooks/use-mobile"
import { useIsTouchDevice } from "@/hooks/use-touch-device"
import { useChatHydrationStore } from "@/lib/chat-hydration-store"
import { getChatWidthClass, useChatWidthStore } from "@/lib/chat-width-store"
import { consumeSuppressedChatTransitionForPath } from "@/lib/chat-transition-override"
import { useHeaderActionsStore } from "@/lib/header-actions-store"
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
// Slightly longer than the transition skeleton's 300ms exit so layout animations
// stay suppressed until it has fully faded.
const CHAT_CONTENT_ENTER_FADE_MS = 350

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

function ChatInitialSkeleton({
    isExiting,
    areHeaderActionsVisible
}: {
    isExiting: boolean
    areHeaderActionsVisible: boolean
}) {
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
                {areHeaderActionsVisible ? (
                    <>
                        <ChatSkeletonBlock className="hidden h-8 w-20 rounded-[var(--radius-md)] sm:block" />
                        <ChatSkeletonBlock className="hidden size-8 rounded-[var(--radius-md)] sm:block" />
                    </>
                ) : null}
                <div className="h-4 w-px bg-border" />
                <ChatSkeletonBlock className="size-8 rounded-[var(--radius-xl)]" />
            </div>

            <NewChatSkeletonBody />
        </motion.div>
    )
}

// A real (invisible, inert) textarea with the composer's classes, so the browser
// sizes it exactly like PromptInputTextarea instead of us hand-matching its box.
// The placeholder bar sits on its first line, where the real placeholder draws.
function ComposerTextareaSkeleton({ className }: { className?: string }) {
    return (
        <div className="relative min-w-0 flex-1">
            <Textarea
                aria-hidden="true"
                tabIndex={-1}
                readOnly
                rows={1}
                className={cn(PROMPT_TEXTAREA_CLASS, "pointer-events-none invisible", className)}
            />
            <div className="absolute top-2 left-3 flex h-6 items-center md:h-5">
                <ChatSkeletonBlock className="h-4 w-28 rounded-[var(--radius-sm)]" />
            </div>
        </div>
    )
}

function ChatComposerSkeleton({
    className,
    isCompact = false
}: {
    className?: string
    isCompact?: boolean
}) {
    // Mirrors isCompactTouchComposer in multimodal-input.tsx: a single row of
    // attach, placeholder, and primary action with the toolbar collapsed away.
    if (isCompact) {
        return (
            <div
                className={cn(
                    "flex items-center gap-1 rounded-[var(--radius-lg)] border border-border/70 bg-composer p-2 shadow-xs",
                    className
                )}
            >
                <ChatSkeletonBlock className="size-11 shrink-0 rounded-[var(--radius-md)]" />
                <ComposerTextareaSkeleton className="!h-11 !min-h-11 overflow-hidden whitespace-nowrap" />
                <ChatSkeletonBlock className="size-11 shrink-0 rounded-[var(--radius-md)]" />
            </div>
        )
    }

    return (
        <div
            className={cn(
                "rounded-[var(--radius-lg)] border border-border/70 bg-composer p-3 shadow-xs",
                className
            )}
        >
            <div className="flex w-full items-start">
                <ComposerTextareaSkeleton />
            </div>
            {/* Same row structure and responsive classes as the real toolbar in
                multimodal-input.tsx (model, empty persona slot, ComposerDesktopActions,
                ComposerMobileMenu, primary action). Reusing its classes also guarantees
                Tailwind has generated them whichever route boots first. */}
            <div className="flex items-center gap-2 pt-2">
                <div className="flex min-w-0 flex-1 items-center @3xl:gap-2 gap-1.5 overflow-hidden">
                    <ChatSkeletonBlock className="h-8 w-36 shrink-0 rounded-[var(--radius-md)]" />
                    <div className="shrink-0" />
                    <div className="@3xl:flex hidden items-center gap-2">
                        <ChatSkeletonBlock className="size-8 rounded-[var(--radius-md)]" />
                        <ChatSkeletonBlock className="size-8 rounded-[var(--radius-md)]" />
                        <ChatSkeletonBlock className="h-8 w-24 rounded-[var(--radius-md)]" />
                    </div>
                </div>
                <div className="@3xl:hidden shrink-0">
                    <ChatSkeletonBlock className="size-8 rounded-[var(--radius-md)]" />
                </div>
                <ChatSkeletonBlock className="size-8 shrink-0 rounded-[var(--radius-md)]" />
            </div>
        </div>
    )
}

function NewChatSkeletonBody() {
    return (
        <div className="@container relative flex h-[calc(100dvh-var(--app-header-height))] items-center justify-center overflow-y-auto px-4 py-16">
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
                </div>

                <div className="w-full px-1">
                    <ChatComposerSkeleton />

                    <div className="mt-3 flex flex-col gap-1 px-2">
                        {["w-36", "w-44", "w-40", "w-32"].map((width) => (
                            <div
                                key={width}
                                className="flex h-9 items-center gap-3 rounded-[var(--radius-md)] px-3"
                            >
                                <ChatSkeletonBlock className="size-4 rounded-[var(--radius-sm)]" />
                                <ChatSkeletonBlock
                                    className={`${width} h-3 rounded-[var(--radius-sm)]`}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

// Mirrors the thread layout in chat.tsx/messages.tsx: user bubbles on the right,
// prose lines on the left, and the composer docked at the bottom with the same
// overlap, so the real thread replaces it without anything moving.
const THREAD_SKELETON_TURNS = [
    { user: "w-48", assistant: ["w-full", "w-11/12", "w-4/5", "w-2/3"] },
    { user: "w-64", assistant: ["w-full", "w-5/6", "w-3/4"] }
]

function ThreadSkeletonBody() {
    const chatWidth = useChatWidthStore((state) => state.chatWidthState.chatWidth)
    const widthClass = getChatWidthClass(chatWidth)
    // Threads open with an unfocused composer, so touch devices land in the
    // compact layout unless a draft is restored.
    const isTouchDevice = useIsTouchDevice()

    return (
        // No overflow clipping here: like the real chat column, the composer hangs
        // below this box by --chat-composer-overlap and only the overlay clips it.
        <div aria-hidden="true" className="relative h-[calc(100dvh-var(--app-header-height))]">
            <div className="p-4 pt-6">
                <div className={cn("mx-auto w-full", widthClass)}>
                    {THREAD_SKELETON_TURNS.map((turn) => (
                        <div key={turn.user}>
                            <div className="my-12 ml-auto w-fit rounded-[var(--radius-md)] border border-border px-4 py-3">
                                <ChatSkeletonBlock
                                    className={`${turn.user} h-4 max-w-[60vw] rounded-[var(--radius-sm)]`}
                                />
                            </div>
                            <div className="flex flex-col gap-3 p-4">
                                {turn.assistant.map((width) => (
                                    <ChatSkeletonBlock
                                        key={width}
                                        className={`${width} h-4 rounded-[var(--radius-sm)]`}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div
                className="absolute inset-x-0 flex flex-col items-center justify-center pb-6"
                style={{ bottom: "calc(-1 * var(--chat-composer-overlap))" }}
            >
                <div className="@container relative z-10 w-full px-1">
                    <ChatComposerSkeleton
                        className={cn("mx-auto w-full", widthClass)}
                        isCompact={isTouchDevice}
                    />
                </div>
                {/* Same backdrop chat.tsx draws behind the thread composer, so it
                    doesn't pop in when the real one takes over. */}
                <div className="pointer-events-none absolute inset-x-0 top-1/2 bottom-0 z-0 bg-sidebar/45 backdrop-blur-md [mask-image:linear-gradient(to_bottom,transparent_0%,black_100%)]" />
            </div>
        </div>
    )
}

// Route-transition stand-in for the old spinner: shaped like whatever is about to
// render so the swap reads as content filling in, not a page change.
function ChatTransitionSkeleton({ target }: { target: CachedChatTarget | null }) {
    const isThreadLike =
        target?.kind === "thread" || target?.kind === "folderThread" || target?.kind === "shared"

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            // The content underneath is already fully rendered and opaque, so this
            // exit is a single cross-fade: shared pieces (composer, backdrop) sit in
            // the same place in both layers and hold steady instead of stacking.
            exit={{ opacity: 0, transition: { duration: 0.3, ease: "easeOut" } }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            aria-busy="true"
            aria-label="Loading conversation"
            className="absolute inset-0 z-20 overflow-hidden bg-background"
            style={{
                backgroundImage: "url(/noise.png)",
                backgroundRepeat: "repeat",
                backgroundSize: "auto"
            }}
        >
            {isThreadLike ? <ThreadSkeletonBody /> : <NewChatSkeletonBody />}
        </motion.div>
    )
}

function ChatLayout() {
    const { data: session, isPending } = useSession()
    const params = useParams({ strict: false })
    const location = useLocation()
    const isMobile = useIsMobile()
    const areHeaderActionsVisible = useHeaderActionsStore((state) =>
        isMobile ? !state.isMobileCollapsed : !state.isDesktopCollapsed
    )

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

        return () => {
            if (chatTransitionHideTimeoutRef.current !== null) {
                window.clearTimeout(chatTransitionHideTimeoutRef.current)
                chatTransitionHideTimeoutRef.current = null
            }

            if (chatTransitionSwapTimeoutRef.current !== null) {
                window.clearTimeout(chatTransitionSwapTimeoutRef.current)
                chatTransitionSwapTimeoutRef.current = null
            }
        }
    }, [currentChatTarget, isLibraryRoute, isMobile])

    // The overlay exits only once the minimum spinner time has passed, the new
    // thread has committed, AND its deferred message render has settled — so slow
    // markdown hydrations never flash stale or half-rendered content.
    useEffect(() => {
        if (!isChatTransitionOverlayVisible) return

        const expectedHydrationKey = getChatTargetHydrationKey(currentChatTarget)
        const isHydrationSettled =
            expectedHydrationKey === null || hydratedChatKey === expectedHydrationKey
        const isReady =
            hasChatTransitionMinSpinnerElapsed &&
            areCachedChatTargetsEqual(displayedChatTarget, currentChatTarget) &&
            isHydrationSettled

        if (!isReady) return

        setIsChatTransitionOverlayVisible(false)
        // Covers the skeleton's exit fade, during which the content is visible
        // underneath and must not animate layout.
        setIsChatContentEntering(true)
    }, [
        isChatTransitionOverlayVisible,
        hasChatTransitionMinSpinnerElapsed,
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
                                    {/* Content stays fully opaque; the skeleton's exit is the
                                        only fade. Fading both at once let the two composer
                                        backdrops stack and flashed darker mid-swap. */}
                                    <div className="flex min-h-0 flex-1 flex-col">
                                        {/* Late composer/toolbar adjustments snap into place
                                            under the skeleton and its exit instead of sliding. */}
                                        <MotionConfig
                                            reducedMotion={
                                                isChatTransitionOverlayVisible ||
                                                isChatContentEntering
                                                    ? "always"
                                                    : "user"
                                            }
                                        >
                                            <PersistentChatView
                                                target={chatTargetToRender}
                                                isActiveRoute={isRenderedChatActiveRoute}
                                            />
                                        </MotionConfig>
                                    </div>
                                </motion.div>
                            ) : null}
                            <AnimatePresence>
                                {isChatTransitionOverlayVisible && !isLibraryRoute ? (
                                    <ChatTransitionSkeleton
                                        key="chat-route-transition"
                                        target={currentChatTarget}
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
                                    areHeaderActionsVisible={areHeaderActionsVisible}
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
    const isNotFound = error instanceof Error && error.message.includes("ArgumentValidationError")

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
