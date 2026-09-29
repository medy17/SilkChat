import { Separator as HeroSeparator } from "@heroui/react"
import type { ComponentProps } from "react"
export function Separator({
    decorative = true,
    ...props
}: ComponentProps<typeof HeroSeparator> & { decorative?: boolean }) {
    return <HeroSeparator {...props} aria-hidden={decorative || undefined} />
}
