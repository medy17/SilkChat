import { useAppConfiguration } from "@/components/app-boot-provider"
import { DefaultSettings } from "@/lib/default-user-settings"

/** Cached display settings stay scoped to the caller's current account. */
export function useCurrentUserSettings(userId: string | undefined, _isLoading: boolean) {
    const { value } = useAppConfiguration()
    return value && value.userId === userId && value.settings
        ? value.settings
        : DefaultSettings(userId ?? "CACHE")
}
