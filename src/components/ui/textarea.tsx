import { TextArea } from "@heroui/react"
import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
    return <TextArea {...props} className={cn("field-sizing-content min-h-16 w-full", className)} />
}
