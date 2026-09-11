import { fn } from "storybook/test"
export const authClient = {
    signOut: fn(async () => ({ data: { success: true }, error: null })),
    signIn: { social: fn(async () => ({ data: { success: true }, error: null })) },
    convex: { token: fn(async () => ({ data: null, error: null })) }
}
