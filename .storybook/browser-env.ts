const fixed: Record<string, string> = {
    VITE_CONVEX_URL: "https://storybook.invalid",
    VITE_CONVEX_API_URL: "https://storybook.invalid"
}
export function optionalBrowserEnv(key: string) {
    if (key === "VITE_R2_PUBLIC_BASE_URL")
        return typeof window === "undefined" ? "http://localhost" : window.location.origin
    return fixed[key]
}
export function browserEnv(key: string) {
    const value = optionalBrowserEnv(key)
    if (!value) throw new Error(`Missing Storybook fixture for environment setting ${key}`)
    return value
}
