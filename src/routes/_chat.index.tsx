import { Chat } from "@/components/chat"
import { createFileRoute } from "@tanstack/react-router"

const CANONICAL_URL = "https://silkchat.dev/"

export const Route = createFileRoute("/_chat/")({
    head: () => ({
        links: [{ rel: "canonical", href: CANONICAL_URL }]
    }),
    component: () => <Chat threadId={undefined} />
})
