import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

export const Route = createFileRoute("/settings/ai-options")({
    component: LegacyAIOptionsRedirect
})

function LegacyAIOptionsRedirect() {
    const navigate = useNavigate()

    useEffect(() => {
        navigate({
            to: "/settings/memory",
            replace: true
        })
    }, [navigate])

    return null
}
