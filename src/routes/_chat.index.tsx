import { createFileRoute } from "@tanstack/react-router"

const CANONICAL_URL = "https://silkchat.dev/"

// The _chat layout renders the new-chat view itself (it has no Outlet), so this route only
// matches the URL. It must not import Chat: `/` is also the landing page, and a static
// import here would ship the whole chat stack to every signed-out visitor.
export const Route = createFileRoute("/_chat/")({
    head: () => ({
        links: [{ rel: "canonical", href: CANONICAL_URL }]
    }),
    component: () => null
})
