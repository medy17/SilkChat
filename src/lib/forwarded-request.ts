export const restoreConfiguredHttpsOrigin = (request: Request, configuredPublicUrl?: string) => {
    if (!configuredPublicUrl) return request

    let publicUrl: URL
    try {
        publicUrl = new URL(configuredPublicUrl)
    } catch {
        return request
    }

    const requestUrl = new URL(request.url)

    if (
        publicUrl.protocol !== "https:" ||
        publicUrl.username ||
        publicUrl.password ||
        publicUrl.port ||
        publicUrl.pathname !== "/" ||
        publicUrl.search ||
        publicUrl.hash ||
        requestUrl.protocol !== "http:" ||
        requestUrl.host !== publicUrl.host
    ) {
        return request
    }

    requestUrl.protocol = publicUrl.protocol
    return new Request(requestUrl, request)
}
