import { ThemeFontStyles } from "@/components/theme-font-styles"
import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext } from "@tanstack/react-router"
import { HeadContent, Outlet, Scripts, useRouter } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { preload, preloadModule } from "react-dom"

import { GlassScript, ThemeScript } from "@/components/theme-script"
import { buildBootAuthScript } from "@/lib/boot-auth"
import { readBootAuthFromRequest } from "@/lib/boot-auth-server"
import { optionalBrowserEnv } from "@/lib/browser-env"
import { OG_DEMOS } from "@/lib/og-content"
import { LOCAL_THEME_FONT_PRELOADS } from "@/lib/theme-font-config"
import globals_css from "@/styles/globals.css?url"
import { Providers } from "../providers"

// Configurable site metadata
const SITE_TITLE = "SilkChat"
const SITE_DESCRIPTION =
    "Sleek, fast, and powerful AI chatbot experience. Generate images, create and chat with Personas, and more."
const SITE_URL = "https://silkchat.dev"

const getConvexOrigin = () => {
    try {
        const convexUrl = optionalBrowserEnv("VITE_CONVEX_URL")
        return convexUrl ? new URL(convexUrl).origin : null
    } catch {
        return null
    }
}
const CONVEX_ORIGIN = getConvexOrigin()

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient
}>()({
    // In SPA mode only this route renders on the server, and its beforeLoad context is
    // dehydrated into the page. Hydration reuses it rather than running this again.
    beforeLoad: () => ({ bootAuth: readBootAuthFromRequest() }),
    head: () => ({
        meta: [
            {
                charSet: "utf-8"
            },
            {
                name: "viewport",
                content:
                    "width=device-width, initial-scale=1, viewport-fit=contain, interactive-widget=resizes-content"
            },
            {
                title: SITE_TITLE
            },
            {
                name: "description",
                content: SITE_DESCRIPTION
            },
            // Theme color meta tags
            {
                name: "theme-color",
                content: "oklch(1 0 0)",
                media: "(prefers-color-scheme: light)"
            },
            {
                name: "theme-color",
                content: "oklch(0.145 0 0)",
                media: "(prefers-color-scheme: dark)"
            },
            // Apple mobile web app
            {
                name: "apple-mobile-web-app-capable",
                content: "yes"
            },
            {
                name: "mobile-web-app-capable",
                content: "yes"
            },
            // Open Graph meta tags
            {
                property: "og:title",
                content: OG_DEMOS.home.title
            },
            {
                property: "og:description",
                content: OG_DEMOS.home.supportingText
            },
            {
                property: "og:image",
                content: `${SITE_URL}/api/og?demo=home`
            },
            {
                property: "og:image:alt",
                content: "SilkChat"
            },
            {
                property: "og:image:width",
                content: "1200"
            },
            {
                property: "og:image:height",
                content: "630"
            },
            {
                property: "og:url",
                content: SITE_URL
            },
            {
                property: "og:type",
                content: "website"
            },
            {
                property: "og:site_name",
                content: SITE_TITLE
            },
            // Twitter Card meta tags
            {
                name: "twitter:card",
                content: "summary_large_image"
            },
            {
                name: "twitter:title",
                content: OG_DEMOS.home.title
            },
            {
                name: "twitter:description",
                content: OG_DEMOS.home.supportingText
            },
            {
                name: "twitter:image",
                content: `${SITE_URL}/api/og?demo=home&format=landscape`
            },
            {
                name: "twitter:image:alt",
                content: "SilkChat"
            }
        ],
        links: [
            { rel: "stylesheet", href: globals_css },
            { rel: "icon", href: "/favicon.ico" },
            { rel: "apple-touch-icon", href: "/apple-icon-180.png" },
            { rel: "manifest", href: "/manifest.webmanifest" },
            // The Convex socket opens as soon as the bundle runs; resolve its host while
            // the bundle downloads.
            ...(CONVEX_ORIGIN
                ? [
                      { rel: "dns-prefetch", href: CONVEX_ORIGIN },
                      { rel: "preconnect", href: CONVEX_ORIGIN }
                  ]
                : []),
            { rel: "preconnect", href: "https://fonts.googleapis.com" },
            {
                rel: "preconnect",
                href: "https://fonts.gstatic.com",
                crossOrigin: "anonymous" as const
            },
            ...LOCAL_THEME_FONT_PRELOADS.map((font) => ({
                rel: "preload",
                href: font.href,
                as: "font",
                type: font.type,
                crossOrigin: "anonymous" as const
            }))
        ]
    }),

    component: RootComponent
})

function RootComponent() {
    return (
        <RootDocument>
            <Outlet />
        </RootDocument>
    )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <BootAuthScript />
                <ThemeFontStyles />
                <ThemeScript />
                <GlassScript />
                <GoogleAdsTag />
                <HeadContent />
            </head>

            <body className="h-dvh overflow-hidden font-sans">
                <Providers>{children}</Providers>

                <Scripts />
            </body>
        </html>
    )
}

// The inline script waits for the stylesheets React hoists above it, so the requests start
// as preloads, which don't; the script's fetches (same URL, mode and credentials) adopt them.
function BootAuthScript() {
    const router = useRouter()
    const bootAuth = Route.useRouteContext({ select: (context) => context.bootAuth })
    if (!bootAuth) return null

    if (bootAuth.hasSession && typeof window === "undefined") {
        preloadSignedInChatAssets(router)
    }

    return (
        <>
            {bootAuth.hasSession ? (
                <link
                    rel="preload"
                    href="/api/auth/get-session"
                    as="fetch"
                    crossOrigin="use-credentials"
                />
            ) : null}
            {bootAuth.hasSession && !bootAuth.convexToken ? (
                <link
                    rel="preload"
                    href="/api/auth/convex/token"
                    as="fetch"
                    crossOrigin="use-credentials"
                />
            ) : null}
            <script
                dangerouslySetInnerHTML={{ __html: buildBootAuthScript(bootAuth) }}
                suppressHydrationWarning
            />
        </>
    )
}

// The chat views are code-split out of `/` so signed-out visitors never download them. For
// a signed-in request the server knows they are needed, so Chat's chunks go into the HTML
// as preloads. The thread route imports Chat statically, which makes its manifest entry
// that chunk list. (The folder and shared routes are lazy files with no manifest entry;
// their small views are preloaded from the entry instead, see preloadBootChunks.)
const CHAT_ASSET_ROUTE_IDS = ["/_chat/thread/$threadId"]
type ManifestLink = string | { href: string }
const linkHref = (link: ManifestLink) => (typeof link === "string" ? link : link.href)

function preloadSignedInChatAssets(router: ReturnType<typeof useRouter>) {
    const routes = router.ssr?.manifest?.routes as
        | Record<string, { preloads?: ManifestLink[]; css?: ManifestLink[] } | undefined>
        | undefined
    const matchedRouteIds = router.state.matches.map((match) => match.routeId as string)
    if (!routes || !matchedRouteIds.includes("/_chat")) return

    const preloaded = new Set(
        matchedRouteIds.flatMap((routeId) => (routes[routeId]?.preloads ?? []).map(linkHref))
    )
    for (const routeId of CHAT_ASSET_ROUTE_IDS) {
        for (const link of routes[routeId]?.preloads ?? []) {
            const href = linkHref(link)
            if (preloaded.has(href)) continue
            preloaded.add(href)
            preloadModule(href)
        }
        for (const link of routes[routeId]?.css ?? []) {
            preload(linkHref(link), { as: "style" })
        }
    }
}

function GoogleAdsTag() {
    const googleAdsId = optionalBrowserEnv("VITE_GOOGLE_ADS_ID")
    if (!googleAdsId) {
        return null
    }

    const scriptContent = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', '${googleAdsId}');
    `

    return (
        <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`} />
            <script
                // biome-ignore lint/security/noDangerouslySetInnerHtml: Google Ads requires this bootstrap snippet
                dangerouslySetInnerHTML={{ __html: scriptContent }}
                suppressHydrationWarning
            />
        </>
    )
}
