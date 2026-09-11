import { useAppConfiguration } from "@/components/app-boot-provider"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { useMutation } from "convex/react"

export function useOnboarding() {
    const { data: session } = useSession()
    const onboardingStatus = useAppConfiguration().live?.onboarding
    const completeOnboardingMutation = useMutation(api.settings.completeOnboarding)

    // Only show onboarding if user is logged in and the server says to show it
    const shouldShowOnboarding =
        !!session?.user?.id &&
        onboardingStatus &&
        !("error" in onboardingStatus) &&
        onboardingStatus.shouldShowOnboarding

    const isLoading = !session || onboardingStatus === undefined

    const completeOnboarding = async () => {
        if (!session?.user?.id) return

        try {
            await completeOnboardingMutation()
        } catch (error) {
            console.error("Error completing onboarding:", error)
        }
    }

    return {
        shouldShowOnboarding,
        isLoading,
        completeOnboarding
    }
}
