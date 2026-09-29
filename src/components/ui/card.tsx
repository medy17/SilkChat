import type * as React from "react"
import { Card as HeroCard } from "@heroui/react"

import { cn } from "@/lib/utils"

function Card({ className, children, ...props }: React.ComponentProps<"div">) {
    return (
        <HeroCard
            children={children}
            data-slot="card"
            className={cn(
                "flex flex-col gap-6 rounded-xl border bg-card px-0 py-6 text-card-foreground shadow-sm",
                className
            )}
            {...props}
        />
    )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <HeroCard.Header
            data-slot="card-header"
            className={cn(
                "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
                className
            )}
            {...props}
        />
    )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
    return (
        <HeroCard.Title
            data-slot="card-title"
            className={cn("font-semibold leading-none", className)}
            {...props}
        />
    )
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
    return (
        <HeroCard.Description
            data-slot="card-description"
            className={cn("text-muted-foreground text-sm", className)}
            {...props}
        />
    )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-action"
            className={cn(
                "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
                className
            )}
            {...props}
        />
    )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <HeroCard.Content
            data-slot="card-content"
            className={cn("block flex-none px-6", className)}
            {...props}
        />
    )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <HeroCard.Footer
            data-slot="card-footer"
            className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
            {...props}
        />
    )
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
