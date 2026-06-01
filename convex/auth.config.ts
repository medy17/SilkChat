import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config"

const staticJwks = process.env.JWKS?.trim() || undefined

export default {
    providers: [getAuthConfigProvider({ jwks: staticJwks })]
}
