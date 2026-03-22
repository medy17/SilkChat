import { createRootRoute } from "@tanstack/react-router"

export * from "@tanstack/react-start-server"

// TanStack's current route generator still emits createServerRootRoute().
// The runtime no longer exports it, so we bridge that mismatch here.
export const createServerRootRoute = () => createRootRoute({})
