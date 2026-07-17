export const DEV_OPEN_ONBOARDING_EVENT = "intern3:open-onboarding"
export const DEV_OPEN_RENEWAL_NUDGE_EVENT = "intern3:open-renewal-nudge"
export const DEV_OPEN_PRO_WELCOME_EVENT = "intern3:open-pro-welcome"

export function openDevOnboarding() {
    document.dispatchEvent(new CustomEvent(DEV_OPEN_ONBOARDING_EVENT))
}

export function openDevRenewalNudge() {
    document.dispatchEvent(new CustomEvent(DEV_OPEN_RENEWAL_NUDGE_EVENT))
}

export function openDevProWelcome() {
    document.dispatchEvent(new CustomEvent(DEV_OPEN_PRO_WELCOME_EVENT))
}
