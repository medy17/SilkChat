import {
    type ErrorComponentProps,
    createFileRoute,
    useLocation,
    useParams
} from "@tanstack/react-router"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { Suspense, startTransition, useEffect, useMemo, useRef, useState } from "react"

import { Header } from "@/components/header"
import { LogoSymbol, SILKSCREEN_DOTS_MASK_URL } from "@/components/logo"
import { MobileBranchGenerationOverlay } from "@/components/mobile-branch-generation-overlay"
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider"
import { PROMPT_EDITOR_MIN_HEIGHT_CLASS } from "@/lib/prompt-editor-layout"
import { ThreadsSidebar } from "@/components/threads-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import type { Id } from "@/convex/_generated/dataModel"
import { useSession } from "@/hooks/auth-hooks"
import { isBootSessionPending } from "@/lib/boot-auth"
import {
    ChatView,
    FolderChatView,
    LandingPageView,
    SharedChatView,
    warmDeferredChunks
} from "@/lib/boot-chunks"
import { markBootSettled } from "@/lib/boot-timing"
import { useIsPreloadableLoaded } from "@/lib/preloadable-component"
import { useIsMobile } from "@/hooks/use-mobile"
import { useIsTouchDevice } from "@/hooks/use-touch-device"
import { useMessageFooterStore } from "@/lib/message-footer-store"
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
    // The SilkScreen wordmark (sidebar header, landing page) draws its halftone through an
    // image mask; fetch it with the page so it never lands after the rest of the logo.
    head: () => ({
        links: [{ rel: "preload", href: SILKSCREEN_DOTS_MASK_URL, as: "image" }]
    }),
    component: ChatLayout
})

const INITIAL_CHAT_SKELETON_EXIT_MS = 250
// A backstop only: the cover lifts on readiness, which normally lands well inside a second.
// Past this, a stalled request must not hold the whole app behind a skeleton.
const INITIAL_CHAT_SKELETON_MAX_MS = 3000
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
            return <ChatView.Component threadId={undefined} isActiveRoute={isActiveRoute} />
        case "thread":
            return <ChatView.Component threadId={target.threadId} isActiveRoute={isActiveRoute} />
        case "folder":
            return (
                <FolderChatView.Component
                    folderId={target.folderId as Id<"projects">}
                    isActiveRoute={isActiveRoute}
                />
            )
        case "folderThread":
            return (
                <ChatView.Component
                    threadId={target.threadId}
                    folderId={target.folderId as Id<"projects">}
                    isActiveRoute={isActiveRoute}
                />
            )
        case "shared":
            return <SharedChatView.Component sharedThreadId={target.sharedThreadId} />
    }
}

const getChatTargetView = (target: CachedChatTarget | null) => {
    switch (target?.kind) {
        case "folder":
            return FolderChatView
        case "shared":
            return SharedChatView
        case undefined:
            return null
        default:
            return ChatView
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
    areHeaderActionsVisible,
    target
}: {
    isExiting: boolean
    areHeaderActionsVisible: boolean
    target: CachedChatTarget | null
}) {
    const isThreadLike =
        target?.kind === "thread" || target?.kind === "folderThread" || target?.kind === "shared"

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

            {/* The header floats over the content, so both bodies start at the top, as
                the content they stand in for does. */}
            {isThreadLike ? <ThreadSkeletonBody /> : <NewChatSkeletonBody />}
        </motion.div>
    )
}

// An empty prompt editor is exactly its min-height, so the skeleton shares that class.
// The placeholder bar sits on its first line, where the real placeholder draws.
function ComposerTextareaSkeleton({ className }: { className?: string }) {
    return (
        <div className="relative min-w-0 flex-1">
            <div
                aria-hidden="true"
                className={cn(
                    PROMPT_EDITOR_MIN_HEIGHT_CLASS,
                    "min-h-[var(--prompt-editor-min-height)]",
                    className
                )}
            />
            <div className="absolute top-2 left-3 flex h-6 items-center md:h-5">
                <ChatSkeletonBlock className="h-4 w-28 rounded-[var(--radius-sm)]" />
            </div>
        </div>
    )
}

function ChatComposerSkeleton({
    className,
    isCompact = false,
    showContextRing = false
}: {
    className?: string
    isCompact?: boolean
    // The real ring's slot, for when it is known to show before the thread loads.
    showContextRing?: boolean
}) {
    // Mirrors isCompactTouchComposer in multimodal-input.tsx: a single row of
    // attach, placeholder, and primary action with the toolbar collapsed away.
    if (isCompact) {
        return (
            <div
                className={cn(
                    "glass-composer flex items-center gap-1 rounded-[var(--radius-lg)] border p-2",
                    className
                )}
            >
                <ChatSkeletonBlock className="size-11 shrink-0 rounded-[var(--radius-md)]" />
                <ComposerTextareaSkeleton className="h-11 [--prompt-editor-min-height:2.75rem] md:[--prompt-editor-min-height:2.75rem]" />
                <ChatSkeletonBlock className="size-11 shrink-0 rounded-[var(--radius-md)]" />
            </div>
        )
    }

    return (
        <div className={cn("glass-composer rounded-[var(--radius-lg)] border p-3", className)}>
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
                    {showContextRing && <ContextRingSkeleton className="@3xl:flex hidden" />}
                </div>
                {showContextRing && <ContextRingSkeleton className="flex @3xl:hidden" />}
                <div className="@3xl:hidden shrink-0">
                    <ChatSkeletonBlock className="size-8 rounded-[var(--radius-md)]" />
                </div>
                <ChatSkeletonBlock className="size-8 shrink-0 rounded-[var(--radius-md)]" />
            </div>
        </div>
    )
}

// The ring is a bare glyph in a 32px slot, with no chip behind it.
function ContextRingSkeleton({ className }: { className: string }) {
    return (
        <div className={cn("size-8 shrink-0 items-center justify-center", className)}>
            <ChatSkeletonBlock className="size-4 rounded-full" />
        </div>
    )
}

// Mirrors the empty-chat hero in chat.tsx: the same column gaps, mascot sizes and
// margins, a greeting line plus its reserved subtitle line, and the composer with
// its starter rows (three intents, Attach a file, temporary chat), so the real
// hero replaces it without anything moving.
function NewChatSkeletonBody() {
    const chatWidth = useChatWidthStore((state) => state.chatWidthState.chatWidth)
    const widthClass = getChatWidthClass(chatWidth)

    return (
        <div
            aria-hidden="true"
            className="@container relative flex h-[calc(100dvh-var(--app-header-height))] flex-col items-center gap-4 overflow-y-auto px-4 py-3 [justify-content:safe_center] sm:gap-6 [@media(min-height:820px)]:gap-8"
        >
            <div className="flex flex-col items-center">
                <div className="relative mb-3 size-24 sm:mb-5 sm:size-28 [@media(max-height:620px)]:hidden [@media(min-height:820px)]:size-32">
                    <ChatSkeletonBlock className="absolute inset-0 rounded-[var(--radius-xl)]" />
                    <LogoSymbol className="absolute inset-1/4 size-1/2 text-muted-foreground/25" />
                </div>
                <div className="relative mb-1 hidden size-14 [@media(max-height:480px)]:hidden [@media(max-height:620px)]:block">
                    <ChatSkeletonBlock className="absolute inset-0 rounded-[var(--radius-xl)]" />
                </div>

                <div className="space-y-2 px-4 [@media(max-height:480px)]:hidden">
                    {/* The h1's text-3xl line box, then the subtitle line it keeps reserved. */}
                    <div className="flex h-9 items-center justify-center">
                        <ChatSkeletonBlock className="h-8 w-64 max-w-[70vw] rounded-[var(--radius-md)]" />
                    </div>
                    <div className="min-h-10 sm:min-h-5" />
                </div>
            </div>

            <div className="w-full max-w-4xl">
                <div className="w-full px-1">
                    <ChatComposerSkeleton className={cn("mx-auto w-full", widthClass)} />

                    <div className={cn("mx-auto mt-3 flex w-full flex-col gap-1 px-2", widthClass)}>
                        {["w-36", "w-44", "w-40", "w-32", "w-28"].map((width) => (
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
    // Stats for nerds is stored on the device, so it is known before the thread loads. A ring
    // shown for a nearly full context can't be known yet; it appears with the thread instead.
    const showsContextRing = useMessageFooterStore((state) => state.footerMode !== "simple")

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
                        showContextRing={showsContextRing}
                    />
                </div>
                {/* Same backdrop chat.tsx draws behind the thread composer, so it
                    doesn't pop in when the real one takes over. */}
                <div className="glass-fade pointer-events-none absolute inset-x-0 top-1/2 bottom-0 z-0" />
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
    const [isInitialRootMount] = useState(isRoot)

    // The server already decided from the cookies: no session cookie means the session was
    // seeded as signed out, and a session cookie means a returning user whose session is
    // in flight. Latched, so the query settling a moment early can't unmount the chat.
    const [isAwaitingBootSession, setIsAwaitingBootSession] = useState(isBootSessionPending)
    if (isAwaitingBootSession && !isPending) setIsAwaitingBootSession(false)
    const isSignedIn = Boolean(session?.user) || (isAwaitingBootSession && isPending)
    const isSessionUnknown = isPending && !isAwaitingBootSession
    const showSessionPendingState = isRoot && isSessionUnknown
    const showLandingPage = isRoot && !isSessionUnknown && !isSignedIn

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

    // The first chat view stays under its skeleton until it has actually settled: the
    // session is known and the view has published its hydration key. No fixed hold, so a
    // fast boot reveals as soon as it is ready and a slow one never reveals half-loaded.
    const [initialChatTarget] = useState(currentChatTarget)
    const [initialCoverPhase, setInitialCoverPhase] = useState<"visible" | "exiting" | "done">(
        () => (initialChatTarget ? "visible" : "done")
    )
    const [hasInitialCoverTimedOut, setHasInitialCoverTimedOut] = useState(false)
    // Views without a hydration key (folder overview, shared thread) are ready once their
    // chunk has loaded; Chat's key already implies it.
    const [initialView] = useState(() => getChatTargetView(initialChatTarget))
    const isInitialViewLoaded = useIsPreloadableLoaded(initialView)
    const initialHydrationKey = getChatTargetHydrationKey(initialChatTarget)
    // The sidebar isn't under the cover, so the user can leave the first view before it
    // settles. Its key will then never arrive; the route transition takes over instead.
    const hasLeftInitialChatTarget =
        isLibraryRoute || !areCachedChatTargetsEqual(currentChatTarget, initialChatTarget)
    const isInitialChatReady =
        !isPending &&
        Boolean(session?.user) &&
        isInitialViewLoaded &&
        (initialHydrationKey === null || hydratedChatKey === initialHydrationKey)
    const isInitialChatCovered = isSignedIn && !isLibraryRoute && initialCoverPhase !== "done"
    const showInitialChatSkeleton = isInitialChatCovered

    // Reset the settle flag synchronously when a toggle starts (render-phase, not an effect) so
    // the entering frame already defers the heavy pane instead of rendering it once and then
    // hiding it. Guarded by the ref so it runs only on an actual route change, never on mount.
    if (previousIsLibraryRouteRef.current !== isLibraryRoute) {
        previousIsLibraryRouteRef.current = isLibraryRoute
        setHasViewTransitionSettled(false)
    }

    useEffect(() => {
        if (!initialView || isInitialViewLoaded) return
        initialView.preload().catch(() => {
            // The view's Suspense boundary retries; the cover's backstop still lifts.
        })
    }, [initialView, isInitialViewLoaded])

    useEffect(() => {
        if (initialCoverPhase === "visible" && hasLeftInitialChatTarget) {
            setInitialCoverPhase("done")
        }
    }, [hasLeftInitialChatTarget, initialCoverPhase])

    useEffect(() => {
        if (!isInitialChatCovered || initialCoverPhase !== "visible") return

        const timeoutId = window.setTimeout(() => {
            setHasInitialCoverTimedOut(true)
        }, INITIAL_CHAT_SKELETON_MAX_MS)

        return () => window.clearTimeout(timeoutId)
    }, [initialCoverPhase, isInitialChatCovered])

    useEffect(() => {
        if (initialCoverPhase !== "visible" || !isSignedIn || hasLeftInitialChatTarget) return
        if (!isInitialChatReady && !hasInitialCoverTimedOut) return

        markBootSettled(isInitialChatReady ? "chat" : "chat-timeout")
        setInitialCoverPhase("exiting")
    }, [
        hasInitialCoverTimedOut,
        hasLeftInitialChatTarget,
        initialCoverPhase,
        isInitialChatReady,
        isSignedIn
    ])

    // Once the first screen is up, load the half of the app it didn't need, so later
    // screens (and their charts, 3D and markdown) are as warm as they were before the split.
    const [isLandingRendered, setIsLandingRendered] = useState(false)
    const isFirstScreenSettled =
        (showLandingPage && isLandingRendered) || (isSignedIn && initialCoverPhase === "done")
    useEffect(() => {
        if (!isFirstScreenSettled) return
        const warm = () => warmDeferredChunks(isSignedIn)
        if (typeof window.requestIdleCallback === "function") {
            const idleId = window.requestIdleCallback(warm, { timeout: 2000 })
            return () => window.cancelIdleCallback(idleId)
        }
        const timeoutId = window.setTimeout(warm, 500)
        return () => window.clearTimeout(timeoutId)
    }, [isFirstScreenSettled, isSignedIn])

    useEffect(() => {
        if (initialCoverPhase !== "exiting") return

        const timeoutId = window.setTimeout(() => {
            setInitialCoverPhase("done")
        }, INITIAL_CHAT_SKELETON_EXIT_MS)

        return () => window.clearTimeout(timeoutId)
    }, [initialCoverPhase])

    useEffect(() => {
        if (!isInitialRootMount) return
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
    }, [isInitialRootMount, isPending, session?.user])

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

    // The views are code-split, and a folder or shared view has no hydration key to wait
    // on, so the overlay also waits for the target's chunk (normally loaded long before).
    const transitionTargetView = getChatTargetView(currentChatTarget)
    const isTransitionViewLoaded = useIsPreloadableLoaded(transitionTargetView)
    useEffect(() => {
        if (!isChatTransitionOverlayVisible || !transitionTargetView || isTransitionViewLoaded) {
            return
        }
        // A failure here is retried by the view's own render; the hook sees that load too.
        transitionTargetView.preload().catch(() => {})
    }, [isChatTransitionOverlayVisible, isTransitionViewLoaded, transitionTargetView])

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
            isTransitionViewLoaded &&
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
        currentChatTarget,
        isTransitionViewLoaded
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

    // Only reachable when the session is refetched with nothing cached (never on boot,
    // where the server has already decided). Plain background; no splash.
    if (showSessionPendingState) {
        return <div aria-busy="true" className="min-h-svh bg-background" />
    }

    if (showLandingPage) {
        return (
            // Its chunk was requested from the entry as soon as the boot said signed out.
            <Suspense fallback={<div aria-busy="true" className="min-h-svh bg-background" />}>
                <LandingPageView.Component />
                <LandingRendered onRendered={() => setIsLandingRendered(true)} />
            </Suspense>
        )
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
                                        isActive={isLibraryRoute}
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
                                                isChatContentEntering ||
                                                isInitialChatCovered
                                                    ? "always"
                                                    : "user"
                                            }
                                        >
                                            {/* Suspends only under a skeleton: the boot
                                                view is preloaded with the page and the
                                                others are warmed once it settles. */}
                                            <Suspense fallback={null}>
                                                <PersistentChatView
                                                    target={chatTargetToRender}
                                                    isActiveRoute={isRenderedChatActiveRoute}
                                                />
                                            </Suspense>
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
                                    isExiting={initialCoverPhase === "exiting"}
                                    areHeaderActionsVisible={areHeaderActionsVisible}
                                    target={initialChatTarget}
                                />
                            ) : null}
                        </AnimatePresence>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </OnboardingProvider>
    )
}

// Sits beside a suspending sibling, so its effect runs only once that content commits.
function LandingRendered({ onRendered }: { onRendered: () => void }) {
    // biome-ignore lint/correctness/useExhaustiveDependencies: fires once, on first commit
    useEffect(() => {
        markBootSettled("landing")
        onRendered()
    }, [])
    return null
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
