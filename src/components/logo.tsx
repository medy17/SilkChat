import RoleplayYourWayLogo from "@/assets/roleplay-your-way.svg"
import SilkchatLogo from "@/assets/silkchat.svg"
import SilkscreenLogo from "@/assets/silkscreen.svg"
import { cn } from "@/lib/utils"
import React from "react"
import Shuriken from "@/logo.svg"

const ShurikenComponent = Shuriken as unknown as React.ComponentType<React.SVGProps<SVGSVGElement>>

const SilkchatLogoComponent = SilkchatLogo as unknown as React.ComponentType<
    React.SVGProps<SVGSVGElement> & { "aria-label"?: string }
>
const SilkscreenLogoComponent = SilkscreenLogo as unknown as React.ComponentType<
    React.SVGProps<SVGSVGElement> & { "aria-label"?: string }
>
const RoleplayYourWayLogoComponent = RoleplayYourWayLogo as unknown as React.ComponentType<
    React.SVGProps<SVGSVGElement> & { "aria-label"?: string }
>

// The symmetric SilkChat Shuriken. Geometry is shared with the OG renderer.
export const LogoSymbol = (props: React.SVGProps<SVGSVGElement>) => <ShurikenComponent {...props} />

export function Logo({ className }: { className?: string }) {
    return <LogoSymbol className={cn("size-full text-foreground", className)} />
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
