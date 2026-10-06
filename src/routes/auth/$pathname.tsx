import { type RestrictionNotice, readRestrictionRedirect } from "@/convex/lib/moderation"
import { createFileRoute } from "@tanstack/react-router"

export type AuthSearch = {
    redirect?: string
    // Set by Better Auth when Google sign-in fails.
    error?: string
    // Set instead of error when the moderation gate refused the sign-in.
    restriction?: RestrictionNotice
}

export const Route = createFileRoute("/auth/$pathname")({
    validateSearch: (search: Record<string, unknown>): AuthSearch => {
        const redirect = search.redirect
        const restriction = readRestrictionRedirect(search.error, search.error_description)
        const error =
            typeof search.error === "string" && search.error.length <= 100
                ? search.error
                : undefined
        return {
            // Internal paths only — reject absolute/protocol-relative URLs.
            ...(typeof redirect === "string" &&
            redirect.startsWith("/") &&
            !redirect.startsWith("//")
                ? { redirect }
                : {}),
            ...(restriction ? { restriction } : error ? { error } : {})
        }
    }
})
