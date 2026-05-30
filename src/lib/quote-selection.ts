export const formatQuotedSelection = (selection: string) => {
    const normalizedSelection = selection.replace(/\r\n?/g, "\n").trim()

    if (!normalizedSelection) {
        return ""
    }

    return normalizedSelection
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")
}

export const appendQuotedSelection = (currentValue: string, selection: string) => {
    const quotedSelection = formatQuotedSelection(selection)

    if (!quotedSelection) {
        return currentValue
    }

    const normalizedCurrentValue = currentValue.trimEnd()

    if (!normalizedCurrentValue) {
        return `${quotedSelection}\n\n`
    }

    return `${normalizedCurrentValue}\n\n${quotedSelection}\n\n`
}
