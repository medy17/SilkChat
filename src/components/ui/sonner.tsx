"use client"

import { cn } from "@/lib/utils"
import { useThemeStore } from "@/lib/theme-store"
import { useResolvedThemeMode } from "@/hooks/use-resolved-theme-mode"
import { Loader2 } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ className, style, toastOptions, icons, ...props }: ToasterProps) => {
    const { themeState } = useThemeStore()
    const resolvedMode = useResolvedThemeMode(themeState.currentMode)
    const classNames = toastOptions?.classNames

    return (
        <Sonner
            theme={resolvedMode as ToasterProps["theme"]}
            className={cn("toaster group", className)}
            icons={{
                // Sonner's default bar spinner looks nothing like the app's; use the shared one.
                loading: <Loader2 className="size-4 animate-spin" />,
                ...icons
            }}
            style={{
                ...style,
                fontFamily: "var(--font-sans)"
            }}
            toastOptions={{
                ...toastOptions,
                classNames: {
                    ...classNames,
                    toast: cn(
                        "group toast font-sans shadow-lg group-[.toaster]:border-border group-[.toaster]:bg-background group-[.toaster]:text-foreground",
                        classNames?.toast
                    ),
                    title: cn("font-sans", classNames?.title),
                    description: cn(
                        "font-sans group-[.toast]:text-muted-foreground",
                        classNames?.description
                    ),
                    actionButton: cn(
                        "font-medium font-sans group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
                        classNames?.actionButton
                    ),
                    cancelButton: cn(
                        "font-medium font-sans group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
                        classNames?.cancelButton
                    ),
                    closeButton: cn("font-sans", classNames?.closeButton)
                }
            }}
            {...props}
        />
    )
}

export { Toaster }
