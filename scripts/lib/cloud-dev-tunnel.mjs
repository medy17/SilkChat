const getTrimmedEnv = (env, name) => env[name]?.trim() || undefined

export const getCloudDevTunnelConfig = (env) => {
    const publicUrl = getTrimmedEnv(env, "DEV_PUBLIC_URL")
    const token = getTrimmedEnv(env, "CLOUDFLARE_TUNNEL_TOKEN")

    if (!publicUrl && !token) {
        return null
    }

    if (!publicUrl || !token) {
        throw new Error(
            "DEV_PUBLIC_URL and CLOUDFLARE_TUNNEL_TOKEN must both be set to enable the Cloudflare development tunnel."
        )
    }

    let parsedUrl
    try {
        parsedUrl = new URL(publicUrl)
    } catch {
        throw new Error("DEV_PUBLIC_URL must be a valid HTTPS URL.")
    }

    if (
        parsedUrl.protocol !== "https:" ||
        parsedUrl.username ||
        parsedUrl.password ||
        parsedUrl.port ||
        parsedUrl.pathname !== "/" ||
        parsedUrl.search ||
        parsedUrl.hash
    ) {
        throw new Error(
            "DEV_PUBLIC_URL must be an HTTPS origin without credentials, a port, path, query, or fragment."
        )
    }

    return {
        hostname: parsedUrl.hostname,
        publicUrl: parsedUrl.origin,
        token
    }
}

export const addViteAllowedHost = (env, hostname) => {
    const existingHosts = (env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS || "")
        .split(",")
        .map((host) => host.trim())
        .filter(Boolean)

    return Array.from(new Set([...existingHosts, hostname])).join(",")
}
