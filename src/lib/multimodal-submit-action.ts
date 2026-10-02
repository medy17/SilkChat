export type MultimodalSubmitAction = "stop" | "send" | "focus"

export function resolveMultimodalSubmitAction(
    status: string,
    inputValue: string,
    attachmentCount = 0
) {
    if (status === "streaming") {
        return "stop" satisfies MultimodalSubmitAction
    }

    if (status === "submitted" || (!inputValue.trim() && attachmentCount === 0)) {
        return "focus" satisfies MultimodalSubmitAction
    }

    return "send" satisfies MultimodalSubmitAction
}
