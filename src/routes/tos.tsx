import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/tos")({
    beforeLoad: () => {
        throw redirect({ to: "/terms-of-service", statusCode: 301 })
    }
})
