import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

export const Route = createFileRoute("/settings/behavior")({
    component: LegacyBehaviorRedirect
})

function LegacyBehaviorRedirect() {
    const navigate = useNavigate()

    useEffect(() => {
        navigate({
            to: "/settings/appearance",
            replace: true
        })
    }, [navigate])

    return null
}
