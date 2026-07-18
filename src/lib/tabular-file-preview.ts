export const TABULAR_PREVIEW_MAX_ROWS = 200
export const TABULAR_PREVIEW_MAX_COLUMNS = 50
export const TABULAR_PREVIEW_MAX_CELL_CHARS = 2_000

export type TabularPreview = {
    rows: string[][]
    truncated: boolean
}

export const isTabularTextFile = (filename: string, mediaType?: string) => {
    const normalizedFilename = filename.toLowerCase()
    const normalizedMediaType = mediaType?.toLowerCase().split(";", 1)[0]
    return (
        normalizedFilename.endsWith(".csv") ||
        normalizedFilename.endsWith(".tsv") ||
        normalizedMediaType === "text/csv" ||
        normalizedMediaType === "text/tab-separated-values"
    )
}

export const getTabularDelimiter = (filename: string, mediaType?: string) =>
    filename.toLowerCase().endsWith(".tsv") ||
    mediaType?.toLowerCase().split(";", 1)[0] === "text/tab-separated-values"
        ? "\t"
        : ","

export const parseDelimitedTextPreview = (
    input: string,
    delimiter: "," | "\t",
    options?: {
        maxRows?: number
        maxColumns?: number
        maxCellChars?: number
    }
): TabularPreview => {
    const maxRows = options?.maxRows ?? TABULAR_PREVIEW_MAX_ROWS
    const maxColumns = options?.maxColumns ?? TABULAR_PREVIEW_MAX_COLUMNS
    const maxCellChars = options?.maxCellChars ?? TABULAR_PREVIEW_MAX_CELL_CHARS
    const source = input.startsWith("\uFEFF") ? input.slice(1) : input
    const rows: string[][] = []
    let row: string[] = []
    let field = ""
    let quoted = false
    let truncated = false

    const appendCharacter = (character: string) => {
        if (field.length < maxCellChars) field += character
        else truncated = true
    }

    const commitField = () => {
        if (row.length < maxColumns) row.push(field)
        else truncated = true
        field = ""
    }

    const commitRow = () => {
        commitField()
        if (rows.length < maxRows) rows.push(row)
        else truncated = true
        row = []
    }

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index]

        if (quoted) {
            if (character === '"') {
                if (source[index + 1] === '"') {
                    appendCharacter('"')
                    index += 1
                } else {
                    quoted = false
                }
            } else {
                appendCharacter(character)
            }
            continue
        }

        if (character === '"' && field.length === 0) {
            quoted = true
        } else if (character === delimiter) {
            commitField()
        } else if (character === "\n") {
            commitRow()
            if (rows.length >= maxRows && index < source.length - 1) {
                truncated = true
                break
            }
        } else if (character !== "\r") {
            appendCharacter(character)
        }
    }

    if (row.length > 0 || field.length > 0) commitRow()

    return { rows, truncated }
}
