import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

export const Route = createFileRoute("/settings/customization")({
    component: LegacyCustomizationRedirect
})

function LegacyCustomizationRedirect() {
    const navigate = useNavigate()

    useEffect(() => {
        navigate({
            to: "/settings/personalization",
            replace: true
        })
    }, [navigate])

    return null
}
