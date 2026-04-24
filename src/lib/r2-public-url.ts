import { browserEnv, optionalBrowserEnv } from "@/lib/browser-env"

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "")

const trimLeadingSlash = (value: string) => value.replace(/^\/+/, "")

const encodeKeyPath = (key: string) =>
    trimLeadingSlash(key)
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")

const getPublicR2BaseUrl = () => {
    const value = optionalBrowserEnv("VITE_R2_PUBLIC_BASE_URL")
    return value ? trimTrailingSlash(value) : undefined
}

export const getR2ProxyUrl = (key: string) => {
    const apiBase = trimTrailingSlash(browserEnv("VITE_CONVEX_API_URL"))
    return `${apiBase}/r2?key=${encodeURIComponent(key)}`
}

export const getPublicR2AssetUrl = (key: string) => {
    const publicBaseUrl = getPublicR2BaseUrl()
    if (!publicBaseUrl) {
        return getR2ProxyUrl(key)
    }

    return `${publicBaseUrl}/${encodeKeyPath(key)}`
}

export const extractR2KeyFromUrl = (url: string) => {
    if (url.startsWith("data:")) return null

    try {
        const parsed = new URL(url, browserEnv("VITE_CONVEX_API_URL"))
        const queryKey = parsed.searchParams.get("key")
        if (queryKey) {
            return queryKey
        }

        const publicBaseUrl = getPublicR2BaseUrl()
        if (!publicBaseUrl) {
            return null
        }

        const publicBase = new URL(publicBaseUrl)
        if (parsed.origin !== publicBase.origin) {
            return null
        }

        const basePath = trimTrailingSlash(publicBase.pathname)
        if (
            basePath &&
            !parsed.pathname.startsWith(`${basePath}/`) &&
            parsed.pathname !== basePath
        ) {
            return null
        }

        const keyPath = trimLeadingSlash(parsed.pathname.slice(basePath.length))
        return keyPath ? decodeURIComponent(keyPath) : null
    } catch {
        return null
    }
}

export const resolvePublicFileUrl = (url: string) => {
    const key = extractR2KeyFromUrl(url)
    if (key) {
        return getPublicR2AssetUrl(key)
    }

    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
        return url
    }

    return `${trimTrailingSlash(browserEnv("VITE_CONVEX_API_URL"))}${url}`
}
