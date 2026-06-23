import { createFileRoute } from "@tanstack/react-router"

const CANONICAL_URL = "https://silkchat.dev/terms-of-service"

export const Route = createFileRoute("/terms-of-service")({
    head: () => ({
        links: [{ rel: "canonical", href: CANONICAL_URL }]
    })
})
