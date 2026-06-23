import { createFileRoute } from "@tanstack/react-router"

const CANONICAL_URL = "https://silkchat.dev/privacy-policy"

export const Route = createFileRoute("/privacy-policy")({
    head: () => ({
        links: [{ rel: "canonical", href: CANONICAL_URL }]
    })
})
