import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { resolvePublicR2AssetReference } from "@/lib/r2-public-url"
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
    return resolvePublicR2AssetReference(avatarValue)
}

export function PersonaAvatar({
    name,
    avatarKind,
    avatarValue,
    className,
    rounded = "xl"
}: {
    name: string
    avatarKind?: "builtin" | "r2"
    avatarValue?: string
    className?: string
    rounded?: "xl" | "full" | "none"
}) {
    const roundedClassName =
        rounded === "full"
            ? "rounded-full"
            : rounded === "none"
              ? "rounded-none"
              : "rounded-[var(--radius-xl)]"

    return (
        <Avatar
            className={cn(
                "size-7 border border-foreground/10 bg-secondary shadow-inner",
                roundedClassName,
                className
            )}
        >
            <AvatarImage
                src={getPersonaAvatarSrc(avatarKind, avatarValue)}
                alt={name}
                className={cn(roundedClassName, "object-contain")}
            />
            <AvatarFallback
                className={cn(
                    roundedClassName,
                    "border-0 bg-secondary text-[0.625rem] shadow-none"
                )}
            >
                {getInitials(name)}
            </AvatarFallback>
        </Avatar>
    )
}
