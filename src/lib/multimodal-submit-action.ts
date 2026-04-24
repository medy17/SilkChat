export type MultimodalSubmitAction = "stop" | "send" | "focus"

export function resolveMultimodalSubmitAction(status: string, inputValue: string) {
    if (status === "streaming") {
        return "stop" satisfies MultimodalSubmitAction
    }

    if (!inputValue.trim()) {
        return "focus" satisfies MultimodalSubmitAction
    }

    return "send" satisfies MultimodalSubmitAction
}
