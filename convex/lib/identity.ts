import type { Auth, UserIdentity } from "convex/server"

type Identity<T extends boolean> = T extends false
    ? UserIdentity & { isAnonymous: false; id: string; authId: string }
    : UserIdentity & { isAnonymous: boolean; id: string; authId: string }

export const getUserIdentity = async <T extends boolean>(
    auth: Auth,
    { allowAnons }: { allowAnons: T }
): Promise<{ error: string } | Identity<T>> => {
    let identity: UserIdentity | null

    try {
        identity = await auth.getUserIdentity()
    } catch (error) {
        console.error("[auth] Failed to resolve user identity", error)
        return { error: "Unauthorized" }
    }

    if (!identity) {
        return { error: "Unauthorized" }
    }

    if (!allowAnons && identity.isAnonymous) {
        return { error: "Unauthorized (anonymous)" }
    }

    return {
        ...identity,
        id:
            typeof (identity as UserIdentity & { userId?: unknown }).userId === "string" &&
            (identity as UserIdentity & { userId?: string }).userId
                ? (identity as UserIdentity & { userId: string }).userId
                : identity.subject,
        authId: identity.subject
    } as Identity<T>
}

export const getOrThrowUserIdentity = async <T extends boolean>(
    auth: Auth,
    { allowAnons }: { allowAnons: T }
): Promise<Identity<T>> => {
    const result = await getUserIdentity(auth, { allowAnons })

    if ("error" in result) {
        throw new Error(result.error === "Unauthorized" ? "Unauthorized" : "User not authenticated")
    }

    return result
}
