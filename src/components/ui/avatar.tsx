import { Avatar as HeroAvatar } from "@heroui/react"
import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"
export function Avatar({ className, ...props }: ComponentProps<typeof HeroAvatar>) {
    return <HeroAvatar {...props} className={cn("size-8 rounded-md", className)} />
}
export const AvatarImage = HeroAvatar.Image
export const AvatarFallback = HeroAvatar.Fallback
