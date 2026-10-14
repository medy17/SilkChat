import {
    TabsList as BaseTabsList,
    TabsTrigger as BaseTabsTrigger,
    Tabs,
    TabsContent
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

export { Tabs, TabsContent }

// The host tabs suit short labels in a wide header. Apps put long labels in narrow
// frames, so triggers keep their natural width and wrap onto a new row instead of
// running off the edge.
export function TabsList({ className, ...props }: ComponentProps<typeof BaseTabsList>) {
    return (
        <BaseTabsList
            className={cn("h-auto max-w-full flex-wrap justify-start", className)}
            {...props}
        />
    )
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof BaseTabsTrigger>) {
    return <BaseTabsTrigger className={cn("h-8 flex-none px-3", className)} {...props} />
}
