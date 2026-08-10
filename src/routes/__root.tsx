import { ThemeFontStyles } from "@/components/theme-font-styles"
import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext } from "@tanstack/react-router"
import { HeadContent, Outlet, Scripts } from "@tanstack/react-router"
import type { ReactNode } from "react"

import { ThemeScript } from "@/components/theme-script"
import { optionalBrowserEnv } from "@/lib/browser-env"
import { staticOgImageUrl } from "@/lib/og-metadata"
import { LOCAL_THEME_FONT_PRELOADS } from "@/lib/theme-font-config"
import globals_css from "@/styles/globals.css?url"
import { Providers } from "../providers"

// Configurable site metadata
const SITE_TITLE = "SilkChat"
const SITE_DESCRIPTION =
    "Sleek, fast, and powerful AI chatbot experience. Generate images, create and chat with Personas, and more."
const SITE_URL = "https://silkchat.dev"

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient
}>()({
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
                content: SITE_TITLE
            },
            {
                property: "og:description",
                content: SITE_DESCRIPTION
            },
            {
                property: "og:image",
                content: staticOgImageUrl(SITE_URL, "home")
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
                content: SITE_TITLE
            },
            {
                name: "twitter:description",
                content: SITE_DESCRIPTION
            },
            {
                name: "twitter:image",
                content: staticOgImageUrl(SITE_URL, "home", "landscape")
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
                <ThemeFontStyles />
                <ThemeScript />
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
