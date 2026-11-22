import { readBootAuth } from "@/lib/boot-auth"
import { createPreloadableComponent } from "@/lib/preloadable-component"

// The two halves of `/` that only one kind of visitor needs. Signed-out visitors never
// download the chat stack; signed-in users never download the landing page (three.js,
// gsap, the pricing section).
export const LandingPageView = createPreloadableComponent(() =>
    import("@/components/landing-page").then((module) => module.LandingPage)
)
export const ChatView = createPreloadableComponent(() =>
    import("@/components/chat").then((module) => module.Chat)
)
export const FolderChatView = createPreloadableComponent(() =>
    import("@/components/folder-chat").then((module) => module.FolderChat)
)
export const SharedChatView = createPreloadableComponent(() =>
    import("@/components/shared-chat").then((module) => module.SharedChat)
)

const CHAT_VIEWS = [ChatView, FolderChatView, SharedChatView]

const preloadAll = (views: { preload: () => Promise<unknown> }[]) => {
    for (const view of views) {
        view.preload().catch(() => {
            // Rendering retries the import and surfaces a real failure.
        })
    }
}

// The view a chat-layout URL renders for a signed-out visitor; null outside the layout
// (settings, pricing, auth pages...), which load nothing extra at boot.
const getSignedOutBootViews = (pathname: string) => {
    if (pathname === "/") return [LandingPageView]
    if (/^\/s\/[^/]+$/.test(pathname)) return [SharedChatView]
    if (/^\/(thread\/[^/]+|folder\/[^/]+\/thread\/[^/]+)$/.test(pathname)) return [ChatView]
    if (/^\/folder\/[^/]+$/.test(pathname)) return [FolderChatView]
    return null
}

const isChatLayoutPath = (pathname: string) =>
    pathname === "/" || /^\/(thread|folder|s|library)(\/|$)/.test(pathname)

/**
 * Starts the chunks for the screen the server already chose, from the entry, so they load
 * alongside the route chunks instead of after them. Signed-in users on a chat-layout page
 * get every chat view up front, as when they were static imports: switching between them
 * must never wait on a chunk. The server also modulepreloads them straight from the HTML.
 * Pages outside the chat layout load nothing extra until the first screen has settled.
 */
export const preloadBootChunks = (pathname: string) => {
    const boot = readBootAuth()
    if (!boot) return
    if (boot.hasSession) {
        if (isChatLayoutPath(pathname)) preloadAll(CHAT_VIEWS)
        return
    }
    const views = getSignedOutBootViews(pathname)
    if (views) preloadAll(views)
}

/**
 * Once the first screen has settled, loads the other half too. Both halves used to load
 * with every page, which kept their heavy pieces (three.js and gsap for the landing,
 * pricing and persona pages; charts and markdown for chat) warm for whatever came next.
 * They still end up loaded; they just no longer hold up the first screen.
 */
export const warmDeferredChunks = (isSignedIn: boolean) => {
    preloadAll(isSignedIn ? [...CHAT_VIEWS, LandingPageView] : [LandingPageView, ...CHAT_VIEWS])
}
