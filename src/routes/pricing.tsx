import { createFileRoute } from "@tanstack/react-router"

const SITE_URL = "https://silkchat.dev"
const TITLE = "Pricing · SilkChat"
const DESCRIPTION =
    "Start free, or go Pro for $8.99 a month: 40+ models, premium image generation, and 25x the usage limits."

export const Route = createFileRoute("/pricing")({
    head: () => ({
        meta: [
            { title: TITLE },
            { name: "description", content: DESCRIPTION },
            { property: "og:title", content: TITLE },
            { property: "og:description", content: DESCRIPTION },
            { name: "twitter:title", content: TITLE },
            { name: "twitter:description", content: DESCRIPTION }
        ],
        links: [{ rel: "canonical", href: `${SITE_URL}/pricing` }]
    })
})
