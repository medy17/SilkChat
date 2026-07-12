import { createFileRoute } from "@tanstack/react-router"

export type AuthSearch = {
    redirect?: string
}

export const Route = createFileRoute("/auth/$pathname")({
    validateSearch: (search: Record<string, unknown>): AuthSearch => {
        const redirect = search.redirect
        // Internal paths only — reject absolute/protocol-relative URLs.
        if (
            typeof redirect === "string" &&
            redirect.startsWith("/") &&
            !redirect.startsWith("//")
        ) {
            return { redirect }
        }
        return {}
    }
})
