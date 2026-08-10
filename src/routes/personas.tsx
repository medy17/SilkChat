import { OG_DEMOS } from "@/lib/og-content"
import { createFileRoute } from "@tanstack/react-router"

const SITE_URL = "https://silkchat.dev"

export const Route = createFileRoute("/personas")({
    head: () => ({
        meta: [
            { title: "Personas · SilkChat" },
            { property: "og:title", content: OG_DEMOS.personas.title },
            { property: "og:description", content: OG_DEMOS.personas.supportingText },
            { property: "og:image", content: `${SITE_URL}/api/og?demo=personas` },
            { name: "twitter:title", content: OG_DEMOS.personas.title },
            { name: "twitter:description", content: OG_DEMOS.personas.supportingText },
            {
                name: "twitter:image",
                content: `${SITE_URL}/api/og?demo=personas&format=landscape`
            }
        ],
        links: [{ rel: "canonical", href: `${SITE_URL}/personas` }]
    })
})
