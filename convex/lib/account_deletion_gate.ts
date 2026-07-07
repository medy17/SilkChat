import { internal } from "../_generated/api"

type AccountDeletionActionQueryCtx = {
    runQuery: unknown
}

export const getAccountDeletionBlockerForAction = async (
    ctx: AccountDeletionActionQueryCtx,
    userId: string
) => {
    const runQuery = ctx.runQuery as (ref: never, args: { userId: string }) => Promise<unknown>
    return await runQuery(internal.account_deletion.getAccountDeletionBlockerInternal as never, {
        userId
    })
}

export const assertAccountNotDeletingForAction = async (
    ctx: AccountDeletionActionQueryCtx,
    userId: string
) => {
    if (await getAccountDeletionBlockerForAction(ctx, userId)) {
        throw new Error("Account deletion is in progress")
    }
}
