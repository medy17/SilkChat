export const THREAD_IMPORT_DIALOG_STATE_EVENT = "thread-import-dialog-state"

export const dispatchThreadImportDialogState = (open: boolean) => {
    document.dispatchEvent(
        new CustomEvent<boolean>(THREAD_IMPORT_DIALOG_STATE_EVENT, {
            detail: open
        })
    )
}
