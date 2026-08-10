import { createFileRoute } from "@tanstack/react-router"

const SITE_URL = "https://silkchat.dev"

export const Route = createFileRoute("/personas")({
    head: () => ({
        meta: [
            { title: "Personas · SilkChat" },
            { property: "og:title", content: "Who would you like to meet today?" },
            { property: "og:image", content: `${SITE_URL}/api/og?demo=personas` },
            { name: "twitter:title", content: "Who would you like to meet today?" },
            {
                name: "twitter:image",
                content: `${SITE_URL}/api/og?demo=personas&format=landscape`
            }
        ],
        links: [{ rel: "canonical", href: `${SITE_URL}/personas` }]
    })
})
