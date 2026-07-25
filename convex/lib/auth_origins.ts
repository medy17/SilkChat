type DynamicAuthBaseURL = {
    allowedHosts: string[]
    fallback: string
    protocol: "auto"
}

const normalizeExactHost = (value: string) => {
    const trimmedValue = value.trim()
    if (!trimmedValue) return undefined

    if (trimmedValue.includes("*") || trimmedValue.includes("?")) {
        throw new Error(
            `BETTER_AUTH_ADDITIONAL_HOSTS entries must be exact hosts without wildcards: ${trimmedValue}`
        )
    }

    let parsedUrl: URL
    try {
        parsedUrl = new URL(
            trimmedValue.startsWith("http://") || trimmedValue.startsWith("https://")
                ? trimmedValue
                : `http://${trimmedValue}`
        )
    } catch {
        throw new Error(`Invalid BETTER_AUTH_ADDITIONAL_HOSTS entry: ${trimmedValue}`)
    }

    if (
        parsedUrl.username ||
        parsedUrl.password ||
        parsedUrl.pathname !== "/" ||
        parsedUrl.search ||
        parsedUrl.hash
    ) {
        throw new Error(
            `BETTER_AUTH_ADDITIONAL_HOSTS entries must be exact hosts without credentials, paths, queries, or fragments: ${trimmedValue}`
        )
    }

    return parsedUrl.host
}

export const buildAuthBaseURLConfig = (
    canonicalBaseURL: string,
    additionalHostsValue?: string
): {
    allowedHosts: string[]
    baseURL: string | DynamicAuthBaseURL
} => {
    const canonicalUrl = new URL(canonicalBaseURL)
    const additionalHosts = (additionalHostsValue || "")
        .split(",")
        .map(normalizeExactHost)
        .filter((host): host is string => Boolean(host))
    const allowedHosts = Array.from(new Set([canonicalUrl.host, ...additionalHosts]))

    if (additionalHosts.length === 0) {
        return {
            allowedHosts,
            baseURL: canonicalUrl.origin
        }
    }

    return {
        allowedHosts,
        baseURL: {
            allowedHosts,
            fallback: canonicalUrl.origin,
            protocol: "auto"
        }
    }
}

export const hasLoopbackAuthHost = (allowedHosts: string[]) =>
    allowedHosts.some((host) => {
        const hostname = new URL(`http://${host}`).hostname
        return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
    })
