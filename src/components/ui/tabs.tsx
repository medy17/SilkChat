"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { LayoutGroup, motion } from "motion/react"

import { cn } from "@/lib/utils"

const TabsSelectionContext = React.createContext<{
    selectedValue: string | undefined
    indicatorLayoutId: string
} | null>(null)

function Tabs({
    className,
    value,
    defaultValue,
    onValueChange,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
    const layoutGroupId = React.useId()
    const selectedValue = value ?? uncontrolledValue

    const handleValueChange = React.useCallback(
        (nextValue: string) => {
            if (value === undefined) {
                setUncontrolledValue(nextValue)
            }
            onValueChange?.(nextValue)
        },
        [onValueChange, value]
    )

    return (
        <LayoutGroup id={layoutGroupId}>
            <TabsSelectionContext.Provider
                value={{ selectedValue, indicatorLayoutId: "tabs-selection-indicator" }}
            >
                <TabsPrimitive.Root
                    data-slot="tabs"
                    className={cn("flex flex-col gap-2", className)}
                    value={value}
                    defaultValue={defaultValue}
                    onValueChange={handleValueChange}
                    {...props}
                />
            </TabsSelectionContext.Provider>
        </LayoutGroup>
    )
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
    return (
        <TabsPrimitive.List
            data-slot="tabs-list"
            className={cn(
                "inline-flex h-9 w-fit items-center justify-center rounded-[var(--radius-md)] bg-black/5 p-[3px] text-muted-foreground dark:bg-black/20",
                className
            )}
            {...props}
        />
    )
}

function TabsTrigger({
    className,
    children,
    value,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
    const selection = React.useContext(TabsSelectionContext)
    const isSelected = selection?.selectedValue === value

    return (
        <TabsPrimitive.Trigger
            data-slot="tabs-trigger"
            className={cn(
                "relative isolate inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] border border-transparent px-8 py-1 font-medium text-foreground text-sm transition-colors focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:text-muted-foreground dark:data-[state=active]:text-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
                className
            )}
            value={value}
            {...props}
        >
            {isSelected && (
                <motion.span
                    aria-hidden="true"
                    data-slot="tabs-selection-indicator"
                    layoutId={selection.indicatorLayoutId}
                    className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] border border-transparent bg-background dark:border-input/50 dark:bg-input/30"
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                />
            )}
            {children}
        </TabsPrimitive.Trigger>
    )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
    return (
        <TabsPrimitive.Content
            data-slot="tabs-content"
            className={cn("flex-1 outline-none", className)}
            {...props}
        />
    )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
