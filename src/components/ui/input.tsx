import { Input as HeroInput } from "@heroui/react"
import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function Input({ className, ...props }: ComponentProps<"input">) {
    return <HeroInput {...props} className={cn("w-full min-w-0", className)} />
}
