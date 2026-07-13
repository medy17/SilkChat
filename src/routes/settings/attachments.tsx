import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

export const Route = createFileRoute("/settings/attachments")({
    component: LegacyAttachmentsRedirect
})

function LegacyAttachmentsRedirect() {
    const navigate = useNavigate()

    useEffect(() => {
        navigate({
            to: "/settings/files",
            search: { type: "all", sort: "newest", page: 1 },
            replace: true
        })
    }, [navigate])

    return null
}
