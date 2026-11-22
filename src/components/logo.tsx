import RoleplayYourWayLogo from "@/assets/roleplay-your-way.svg"
import SilkchatLogo from "@/assets/silkchat.svg"
import silkscreenDotsMask from "@/assets/silkscreen-dots.png"
import { cn } from "@/lib/utils"
import React, { useId } from "react"

const SilkchatLogoComponent = SilkchatLogo as unknown as React.ComponentType<
    React.SVGProps<SVGSVGElement> & { "aria-label"?: string }
>
const RoleplayYourWayLogoComponent = RoleplayYourWayLogo as unknown as React.ComponentType<
    React.SVGProps<SVGSVGElement> & { "aria-label"?: string }
>

export const LogoPath = ({ fill }: { fill: string }) => (
    <path
        d="M1127,347.91v-172.9C1127,87.61,1021.2-3.69,934.7.11H190.4C86.7,6.31,4.5,85.81,0,190.51v701.4c1.9,12.8,2.1,25.7,4.6,38.4,15.9,83.5,91.3,146.4,175,154.1l.4,139.2c8.5,47.3,62.4,68.6,101.2,39.1l185.1-178.2,482.1-.3c78.8,0,178.6-89.6,178.6-169V377.11h-233.4l-118.2,125h223.6c5.4,8.1,1.1,21.7.9,32.3-1.6,84.1,1.8,169.6,2.1,253.7.3,67,19,166.2-73.2,173l-489.8.4c-10.2,1.9-19.7,6.9-27.8,13.2-34.1,26.7-67,68-99.6,97.7-5.2,4.8-11.4,8.8-16.7,13.6v-77.2c0-4.5-10.2-23-13.7-27.3-27.7-33.2-64.6-14.3-100-23.1-28.4-7-49.7-30.5-54-59.2l-.2-712.7c-.9-23.8,35.1-61.5,57.6-61.5h700.2l-235.7,250.1c-41.7,5.5-84.5-2.9-126,6.3-84.2,18.7-142.7,94.6-146.1,180.1v368.2h126.9v-211.9L999,195.41c4.4-.8,2.7,1.9,2.9,4.8,2.4,32.6-1,69.3,0,103.5.4,13.9.3,28.3-1.2,42.1l126.1,1.9h0l.2.2ZM1335,377.21h-167v125c7.1,1.3,13.8-1.8,20.4-2,34.6-1.2,77.2-1.9,111.5,0,48.7,2.7,75.7,25.2,79.1,75.2-2,190.4,3.7,381.5-2.9,571.5-6.4,20.8-21.8,38-42.1,45.8-38,14.6-87.1-8.9-121.1,23.4-6,5.7-17.5,25.4-17.5,33.3v75.2c-4.9-1.3-10.6-6.5-14.6-9.8-37.2-31-83.5-79-122.2-104.3-13.6-8.9-27.6-11.9-43.7-12.9h-453c-37.5-7.9-62.6-40.5-57.8-79l-2.9-4.1-23.5,3.1-85,85.1c22.4,61.7,82,106.3,146.1,117.6l475.2,3.3c63.5,47.9,121.9,105,184.5,153.4,47.6,36.8,101.2,31.3,119.9-30.4l.2-123.8c99.6-4.3,181.8-84.3,185.6-184.5-7.9-188.4,10.3-385,0-572.4-5.2-94.2-71.8-179-169-188.4h0l-.2-.3ZM741.8,657.01c-130.8,13.3-95.1,219.2,36.4,182.9,106.7-29.4,78.1-194.5-36.4-182.9h0Z"
        fill={fill}
    />
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

// The SilkScreen wordmark. "Silk" is a small vector path in the text colour. "Screen" is a
// halftone that used to be one 310KB path (src/assets/silkscreen.svg, kept as the source).
// It is now a PNG used as an alpha mask over a primary-coloured rect: it still follows the
// theme, but there is no huge path to parse or rasterise. The mask is rendered at 2px per
// unit (enough for the largest use at 3x DPR) and cropped to the halftone's box below.
const SILKSCREEN_SILK_PATH =
    "M71.06,55.38c8.53,1.43,15.3,4.15,20.28,8.17,4.99,4.01,7.46,9.03,7.43,15.04,0,5.87-2.05,11.05-6.15,15.56-4.1,4.51-9.85,8-17.24,10.48-7.39,2.47-15.87,3.71-25.44,3.71s-17.9-1.3-25.33-3.9-13.28-6.28-17.57-11.03S.41,83.19,0,76.99h26.21c1.15,3.7,3.96,6.7,8.45,8.99,4.49,2.29,9.82,3.44,15.99,3.44s11.13-1.01,14.88-3.02c3.75-2.02,5.63-4.66,5.63-7.92-.07-2.31-.91-4.23-2.52-5.77-1.61-1.54-4.06-2.55-7.34-3.03l-33.81-5.28c-7.5-.92-13.54-3.44-18.12-7.56-4.58-4.12-6.87-9.12-6.87-14.99,0-5.32,1.98-10.02,5.93-14.11,3.95-4.09,9.55-7.25,16.79-9.49s15.57-3.37,24.99-3.41c13.15-.07,24.02,2.74,32.59,8.44,8.57,5.7,13.32,13.24,14.24,22.63h-26.1c-.81-3.48-3.27-6.33-7.37-8.55-4.1-2.22-9.02-3.42-14.74-3.6-5.58-.18-10.08.51-13.5,2.09-3.42,1.58-5.13,3.74-5.13,6.49,0,1.98.69,3.64,2.08,4.98,1.39,1.34,3.22,2.15,5.51,2.45l33.25,5.61h.02ZM119.61,106.63l-.33-47.18.83-9.46-.83-.77-7.92.55h-8.76v-17.49h41.56l.22,74.35s-24.77,0-24.77,0ZM127.37,25.3l-13.08-12.37v-.22L127.59,0h.22l13.19,12.48v.22l-13.41,12.59h-.22ZM159.12,106.63V16.55h25.99v90.08s-25.99,0-25.99,0ZM199.86,106.63V16.55h26.21v36.46l-1.11,5.88h9.31l31.53-26.62h28.93v2.58l-36.85,27.94-2.77,1.49v.99l2.77,1.37,39.46,37.39v2.58h-29.26l-37.24-38.88-1.11-.66-4.77-2.58,1.11,5.28v36.84h-26.21v.02Z"
const SILKSCREEN_DOTS_BOX = { x: 296.027, y: 13.979, width: 581.553, height: 93.861 }
export const SILKSCREEN_DOTS_MASK_URL = silkscreenDotsMask

export function LibraryLogo({ className }: { className?: string }) {
    const maskId = useId()
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="877.58"
            height="108.34"
            viewBox="0 0 877.58 108.34"
            role="img"
            aria-label="Library Logo"
            className={cn(className, "text-foreground")}
        >
            <defs>
                <mask
                    id={maskId}
                    maskUnits="userSpaceOnUse"
                    {...SILKSCREEN_DOTS_BOX}
                    style={{ maskType: "alpha" }}
                >
                    <image
                        href={silkscreenDotsMask}
                        {...SILKSCREEN_DOTS_BOX}
                        preserveAspectRatio="none"
                    />
                </mask>
            </defs>
            <path fill="currentColor" d={SILKSCREEN_SILK_PATH} />
            <rect {...SILKSCREEN_DOTS_BOX} fill="var(--primary)" mask={`url(#${maskId})`} />
        </svg>
    )
}
