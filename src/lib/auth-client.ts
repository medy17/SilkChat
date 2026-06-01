import { convexClient } from "@convex-dev/better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
    plugins: [convexClient()],
    sessionOptions: {
        // Better Auth currently double-fetches /get-session on window focus.
        refetchOnWindowFocus: false
    }
})
