import { cn } from "@/lib/utils"
import { memo } from "react"

export const ImageLoadIndicator = memo(({ complete }: { complete: boolean }) => {
    const radius = 15
    const circumference = 2 * Math.PI * radius

    return (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="relative flex size-12 items-center justify-center rounded-full border border-background/70 bg-background/70 shadow-sm backdrop-blur-sm">
                <svg
                    viewBox="0 0 40 40"
                    className={cn("-rotate-90 size-10", !complete && "animate-spin")}
                    aria-hidden="true"
                >
                    <circle
                        cx="20"
                        cy="20"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="text-foreground/10"
                    />
                    <circle
                        cx="20"
                        cy="20"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={complete ? 0 : circumference * 0.42}
                        className="text-foreground/70 transition-[stroke-dashoffset] duration-300 ease-out"
                    />
                </svg>
                <div
                    className={cn(
                        "absolute size-1.5 rounded-full bg-foreground/55 transition-colors duration-300",
                        complete && "bg-foreground/80"
                    )}
                />
            </div>
        </div>
    )
})

ImageLoadIndicator.displayName = "ImageLoadIndicator"
