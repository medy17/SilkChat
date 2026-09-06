export function splitSpeechText(text: string, maxCharacters: number): string[] {
    const chunks: string[] = []
    let remaining = text.trim()
    while (remaining.length > maxCharacters) {
        const prefix = remaining.slice(0, maxCharacters)
        const boundary = Math.max(
            prefix.lastIndexOf("\n"),
            prefix.lastIndexOf(". "),
            prefix.lastIndexOf("! "),
            prefix.lastIndexOf("? ")
        )
        let end = boundary > maxCharacters / 2 ? boundary + 1 : prefix.lastIndexOf(" ")
        if (end <= 0) end = maxCharacters
        // Do not split a UTF-16 surrogate pair.
        if (/[\uD800-\uDBFF]/.test(remaining[end - 1] ?? "")) end--
        chunks.push(remaining.slice(0, end).trim())
        remaining = remaining.slice(end).trim()
    }
    if (remaining) chunks.push(remaining)
    return chunks
}
