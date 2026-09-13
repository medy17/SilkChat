import { SILKCHAT_SYMBOL_PATH } from "@/lib/silkchat-symbol-path"
import RoleplayYourWayLogo from "@/assets/roleplay-your-way.svg"
import SilkchatLogo from "@/assets/silkchat.svg"
import SilkscreenLogo from "@/assets/silkscreen.svg"
import { cn } from "@/lib/utils"
import React from "react"

const SilkchatLogoComponent = SilkchatLogo as unknown as React.ComponentType<
    React.SVGProps<SVGSVGElement> & { "aria-label"?: string }
>
const SilkscreenLogoComponent = SilkscreenLogo as unknown as React.ComponentType<
    React.SVGProps<SVGSVGElement> & { "aria-label"?: string }
>
const RoleplayYourWayLogoComponent = RoleplayYourWayLogo as unknown as React.ComponentType<
    React.SVGProps<SVGSVGElement> & { "aria-label"?: string }
>

export const LogoPath = ({ fill }: { fill: string }) => (
    <path d={SILKCHAT_SYMBOL_PATH} fill={fill} />
)

export const LogoSymbol = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => {
    return (
        <svg
            viewBox="0 0 1507.45 1499.99"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            {...props}
        >
            <LogoPath fill={"currentColor"} />
        </svg>
    )
}

export function Logo({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 1507.45 1499.99"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("size-full text-foreground", className)}
            style={{ color: "var(--foreground)" }}
        >
            <LogoPath fill="currentColor" />
        </svg>
    )
}

export function LogoMark({ className }: { className?: string }) {
    return React.createElement(SilkchatLogoComponent, {
        "aria-label": "Chat Logo",
        className: cn(className, "text-foreground")
    })
}

// Color is inherited from the parent (fill="currentColor") so callers can tint
// it with the landing-page palette instead of the global foreground token.
export function RoleplayWordmark({ className }: { className?: string }) {
    return React.createElement(RoleplayYourWayLogoComponent, {
        "aria-label": "Roleplay Your Way",
        className: cn(className)
    })
}

export function LibraryLogo({ className }: { className?: string }) {
    return React.createElement(SilkscreenLogoComponent, {
        "aria-label": "Library Logo",
        className: cn(className, "text-foreground")
    })
}
