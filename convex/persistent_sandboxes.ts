import { query } from "./_generated/server"

/**
 * Convex deploys before the frontend, and the old composer subscribes to this. A missing function
 * would crash every open tab until it reloads. Remove one release after the computer ships.
 */
export const getMyActivePersistentSandbox = query({
    args: {},
    handler: async () => null
})
