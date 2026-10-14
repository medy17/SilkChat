// The frame runs production React, whose errors are codes and a URL. These are the ones
// model-written apps hit, spelled out so the error card says what went wrong.
const REACT_ERRORS: Record<string, (arg: string) => string> = {
    "31": (arg) =>
        `Objects can't be rendered as React children (found ${arg || "an object"}). Render a field or String(value) instead.`,
    "130": (arg) =>
        `A component was expected but got ${arg || "something else"}. Check that every imported component exists, and pass a component where one is expected rather than a rendered element.`,
    "185": () =>
        "Maximum update depth exceeded: a state update runs on every render, often a setState in an effect without dependencies.",
    "301": () => "Too many re-renders: a state setter is called during render."
}

const MINIFIED_REACT_ERROR = /Minified React error #(\d+); visit (\S+)/

export const describeAppError = (error: unknown) => {
    const message = error instanceof Error ? error.message || error.name : String(error)
    const match = MINIFIED_REACT_ERROR.exec(message)
    const explain = match ? REACT_ERRORS[match[1]] : undefined
    if (!match || !explain) return message

    let arg = ""
    try {
        arg = new URL(match[2]).searchParams.getAll("args[]")[0] ?? ""
    } catch {}
    return explain(arg)
}
