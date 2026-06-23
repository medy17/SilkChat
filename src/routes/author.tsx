import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/author")({
    beforeLoad: () => {
        throw redirect({ to: "/about", statusCode: 301 })
    }
})
