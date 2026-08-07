export type CloudDevTunnelConfig = {
    hostname: string
    publicUrl: string
    token: string
}

export function getCloudDevTunnelConfig(
    env: Record<string, string | undefined>
): CloudDevTunnelConfig | null

export function addViteAllowedHost(
    env: Record<string, string | undefined>,
    hostname: string
): Record<string, string | undefined>
