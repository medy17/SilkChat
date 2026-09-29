import { Badge } from "@/components/ui/badge"
import { getModelExpiry } from "@/lib/model-expiry"
import { cn } from "@/lib/utils"
import { CalendarClock } from "lucide-react"

// Scheduled removal as a badge: neutral while it's a way off, a warning in the final week.
export function ModelExpiryBadge({
    expirationDate,
    className
}: {
    expirationDate: string
    className?: string
}) {
    const expiry = getModelExpiry(expirationDate)
    if (!expiry) return null

    return (
        <Badge variant={expiry.isSoon ? "warning" : "secondary"} className={cn("gap-1", className)}>
            <CalendarClock className="size-3" aria-hidden="true" />
            {expiry.label}
        </Badge>
    )
}
