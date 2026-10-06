import { convexClient } from "@convex-dev/better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import { adminClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    plugins: [convexClient(), adminClient()],
    sessionOptions: {
        // Better Auth currently double-fetches /get-session on window focus.
        refetchOnWindowFocus: false
    }
})
