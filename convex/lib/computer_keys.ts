export const MAX_COMPUTER_KEYS = 20
export const MAX_COMPUTER_KEY_VALUE_LENGTH = 4_096
export const MAX_COMPUTER_KEY_LABEL_LENGTH = 40
export const COMPUTER_KEY_EXPIRY_WARNING_DAYS = 7

const DAY_MS = 24 * 60 * 60_000

// Tools that insist on a key at startup get this. The proxy overwrites the header it produces.
export const COMPUTER_KEY_PLACEHOLDER = "silkchat-proxy"

type PresetRoute = {
    host: string
    headerName: string
    /** Added before the key. Omit for a header that takes the bare key. */
    valuePrefix?: string
    /** Git over HTTPS sends Basic auth, so the key is wrapped rather than prefixed. */
    gitBasicAuth?: boolean
}

export type ComputerKeyPreset = {
    id: string
    label: string
    envName: string
    helpUrl: string
    help: string
    routes: PresetRoute[]
}

const bearer = (host: string): PresetRoute => ({
    host,
    headerName: "Authorization",
    valuePrefix: "Bearer "
})

export const COMPUTER_KEY_PRESETS: ComputerKeyPreset[] = [
    {
        id: "github",
        label: "GitHub",
        envName: "GH_TOKEN",
        helpUrl: "https://github.com/settings/personal-access-tokens/new",
        help: "Create a fine-grained token. Under Repository access, pick only the repositories Silky should use, then give it read and write on Contents and Pull requests.",
        routes: [
            { host: "github.com", headerName: "Authorization", gitBasicAuth: true },
            bearer("api.github.com")
        ]
    },
    {
        id: "openai",
        label: "OpenAI",
        envName: "OPENAI_API_KEY",
        helpUrl: "https://platform.openai.com/api-keys",
        help: "Create a new secret key. Restricted keys are the safest choice.",
        routes: [bearer("api.openai.com")]
    },
    {
        id: "anthropic",
        label: "Anthropic",
        envName: "ANTHROPIC_API_KEY",
        helpUrl: "https://console.anthropic.com/settings/keys",
        help: "Create a key in the Anthropic Console.",
        routes: [{ host: "api.anthropic.com", headerName: "x-api-key" }]
    },
    {
        id: "google",
        label: "Google AI",
        envName: "GEMINI_API_KEY",
        helpUrl: "https://aistudio.google.com/apikey",
        help: "Create an API key in Google AI Studio.",
        routes: [{ host: "generativelanguage.googleapis.com", headerName: "x-goog-api-key" }]
    },
    {
        id: "openrouter",
        label: "OpenRouter",
        envName: "OPENROUTER_API_KEY",
        helpUrl: "https://openrouter.ai/settings/keys",
        help: "Create a key. You can set a credit limit on it.",
        routes: [bearer("openrouter.ai")]
    },
    {
        id: "stripe",
        label: "Stripe",
        envName: "STRIPE_API_KEY",
        helpUrl: "https://dashboard.stripe.com/apikeys",
        help: "Use a test key or a restricted key. Avoid your live secret key.",
        routes: [bearer("api.stripe.com")]
    },
    {
        id: "vercel",
        label: "Vercel",
        envName: "VERCEL_TOKEN",
        helpUrl: "https://vercel.com/account/tokens",
        help: "Create a token scoped to one team, with an expiry date.",
        routes: [bearer("api.vercel.com")]
    },
    {
        id: "cloudflare",
        label: "Cloudflare",
        envName: "CLOUDFLARE_API_TOKEN",
        helpUrl: "https://dash.cloudflare.com/profile/api-tokens",
        help: "Create an API token limited to the permissions Silky needs.",
        routes: [bearer("api.cloudflare.com")]
    }
]

export const CUSTOM_COMPUTER_KEY_ID = "custom"

export type ComputerKeyConfig = {
    presetId: string
    host?: string
    headerName?: string
    valuePrefix?: string
    envName?: string
}

export type ComputerKeyRoute = { host: string; headerName: string; headerValue: string }

export const getComputerKeyPreset = (presetId: string) =>
    COMPUTER_KEY_PRESETS.find((preset) => preset.id === presetId)

export const getComputerKeyEnvName = (key: ComputerKeyConfig) =>
    getComputerKeyPreset(key.presetId)?.envName ?? key.envName

export const getComputerKeyHosts = (key: ComputerKeyConfig) => {
    const preset = getComputerKeyPreset(key.presetId)
    if (preset) return preset.routes.map((route) => route.host)
    return key.host ? [key.host] : []
}

export const getComputerKeyRoutes = (
    key: ComputerKeyConfig,
    secret: string
): ComputerKeyRoute[] => {
    const preset = getComputerKeyPreset(key.presetId)
    if (preset) {
        return preset.routes.map((route) => ({
            host: route.host,
            headerName: route.headerName,
            headerValue: route.gitBasicAuth
                ? `Basic ${btoa(`x-access-token:${secret}`)}`
                : `${route.valuePrefix ?? ""}${secret}`
        }))
    }
    if (!key.host) return []
    return [
        {
            host: key.host,
            headerName: key.headerName || "Authorization",
            headerValue: `${key.valuePrefix ?? ""}${secret}`
        }
    ]
}

/** Two keys can't share a host: the proxy only sends one credential to each. */
export const findComputerKeyHostConflict = (
    key: ComputerKeyConfig,
    enabledKeys: ComputerKeyConfig[]
) => {
    const taken = new Set(enabledKeys.flatMap(getComputerKeyHosts))
    return getComputerKeyHosts(key).find((host) => taken.has(host))
}

/** Whole days left, so a key that ends tonight reads as today rather than tomorrow. */
export const getComputerKeyExpiry = (expiresAt: number | undefined, now: number) => {
    if (expiresAt === undefined) return null
    if (expiresAt <= now) return { state: "expired" as const, label: "Expired" }
    const daysLeft = Math.floor((expiresAt - now) / DAY_MS)
    const label =
        daysLeft === 0
            ? "Expires today"
            : daysLeft === 1
              ? "Expires tomorrow"
              : `Expires in ${daysLeft} days`
    return {
        state: daysLeft <= COMPUTER_KEY_EXPIRY_WARNING_DAYS ? ("soon" as const) : ("ok" as const),
        label
    }
}

const HOST_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
const HEADER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/
const ENV_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/
const RESERVED_HEADERS = new Set([
    "connection",
    "content-length",
    "cookie",
    "host",
    "proxy-authorization",
    "set-cookie",
    "transfer-encoding"
])
const RESERVED_ENV_NAMES = new Set([
    "HOME",
    "HOSTNAME",
    "LD_PRELOAD",
    "LD_LIBRARY_PATH",
    "NODE_OPTIONS",
    "PATH",
    "SHELL",
    "SILKCHAT_ARTIFACT_DIR",
    "USER"
])

export const normalizeComputerKeyHost = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")

/** Returns what's wrong with a custom key, or null. Keeps a key from going to a loose match. */
export const validateCustomComputerKey = ({
    host,
    headerName,
    envName
}: {
    host: string
    headerName?: string
    envName?: string
}) => {
    if (!HOST_PATTERN.test(host)) return "Enter a web address like api.example.com"
    if (headerName) {
        if (!HEADER_PATTERN.test(headerName) || RESERVED_HEADERS.has(headerName.toLowerCase())) {
            return "That header name can't be used"
        }
    }
    if (envName && (!ENV_PATTERN.test(envName) || RESERVED_ENV_NAMES.has(envName))) {
        return "That variable name can't be used"
    }
    return null
}

/** Environment variables for keys that are on. These are placeholders, never the real key. */
export const getComputerKeyEnv = (keys: ComputerKeyConfig[]) =>
    Object.fromEntries(
        keys.flatMap((key) => {
            const envName = getComputerKeyEnvName(key)
            return envName ? [[envName, COMPUTER_KEY_PLACEHOLDER]] : []
        })
    )

/** What the model is told about keys that are on: names and hosts only. */
export const describeComputerKeys = (
    keys: Array<ComputerKeyConfig & { label: string; expiresAt?: number }>,
    now = Date.now()
) => {
    if (keys.length === 0) return "No keys are connected. Public sites and APIs still work."
    let anyExpiring = false
    const lines = keys.map((key) => {
        const envName = getComputerKeyEnvName(key)
        const expiry = getComputerKeyExpiry(key.expiresAt, now)
        const warning = expiry && expiry.state !== "ok" ? ` ${expiry.label}.` : ""
        anyExpiring ||= warning !== ""
        return `- ${key.label}: ${getComputerKeyHosts(key).join(", ")}${envName ? ` (${envName} is set)` : ""}${warning}`
    })
    return [
        "These keys are connected, and you may use them whenever the task calls for it. Requests to these hosts are signed automatically on the way out, so make the call normally and add no credentials of your own. You cannot read the key values, and environment variables hold a placeholder.",
        ...lines,
        ...(anyExpiring
            ? [
                  "If you use a key marked as expiring or expired, tell the user once, and point them to Settings, Computer to replace it. An expired key may be refused."
              ]
            : [])
    ].join("\n")
}
