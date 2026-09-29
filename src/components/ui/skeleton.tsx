import { Skeleton as HeroSkeleton } from "@heroui/react"
import type { ComponentProps } from "react"
export function Skeleton(props: ComponentProps<"div">) {
    return <HeroSkeleton {...props} />
}
