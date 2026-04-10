import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { browserEnv } from "@/lib/browser-env"
import { cn } from "@/lib/utils"

const getInitials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "P"

export const getPersonaAvatarSrc = (avatarKind?: "builtin" | "r2", avatarValue?: string) => {
    if (!avatarKind || !avatarValue) return undefined
    if (avatarKind === "builtin") return avatarValue
    return `${browserEnv("VITE_CONVEX_API_URL")}/r2?key=${encodeURIComponent(avatarValue)}`
}

export function PersonaAvatar({
    name,
    avatarKind,
    avatarValue,
    className,
    rounded = "lg"
}: {
    name: string
    avatarKind?: "builtin" | "r2"
    avatarValue?: string
    className?: string
    rounded?: "lg" | "full"
}) {
    const roundedClassName = rounded === "full" ? "rounded-full" : "rounded-lg"

    return (
        <Avatar className={cn("size-7", roundedClassName, className)}>
            <AvatarImage src={getPersonaAvatarSrc(avatarKind, avatarValue)} alt={name} />
            <AvatarFallback className={cn(roundedClassName, "text-[10px]")}>
                {getInitials(name)}
            </AvatarFallback>
        </Avatar>
    )
}
