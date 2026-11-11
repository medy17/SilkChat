export const THREAD_IMPORT_DIALOG_STATE_EVENT = "thread-import-dialog-state"

export const dispatchThreadImportDialogState = (open: boolean) => {
    document.dispatchEvent(
        new CustomEvent<boolean>(THREAD_IMPORT_DIALOG_STATE_EVENT, {
            detail: open
        })
    )
}

export const THREAD_IMPORT_FILE_EVENT = "thread-import-file"

// Hands a file to the mounted Import dialog. Returns false when no dialog is listening,
// such as outside the chat layout.
export const requestThreadImportFile = (file: File) =>
    !document.dispatchEvent(
        new CustomEvent<File>(THREAD_IMPORT_FILE_EVENT, { detail: file, cancelable: true })
    )
