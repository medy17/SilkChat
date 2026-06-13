export const buildLemonSqueezyCheckoutUrl = ({
    checkoutUrl,
    userId,
    email,
    name
}: {
    checkoutUrl: string
    userId: string
    email?: string | null
    name?: string | null
}) => {
    const url = new URL(checkoutUrl)
    url.searchParams.set("checkout[custom][user_id]", userId)

    if (email) {
        url.searchParams.set("checkout[email]", email)
    }

    if (name) {
        url.searchParams.set("checkout[name]", name)
    }

    return url.toString()
}
