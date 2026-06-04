import { getLastChatRoute } from "@/lib/last-chat-route"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { Button } from "../ui/button"

export function SettingsBackButton() {
    const navigate = useNavigate()

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate({ href: getLastChatRoute() })}
        >
            <ArrowLeft className="h-4 w-4" />
            Back
        </Button>
    )
}
