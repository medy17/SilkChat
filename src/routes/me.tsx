import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/me")({
    beforeLoad: () => {
        throw redirect({ to: "/about", statusCode: 301 })
    }
})
