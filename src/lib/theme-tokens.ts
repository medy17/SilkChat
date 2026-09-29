/** Saved SilkChat themes retain their original token names. */
export function themeTokenName(name: string): string {
    return name === "accent" || name === "accent-foreground" || name === "muted"
        ? `silk-${name}`
        : name
}

export function themeTokenValue(value: string): string {
    return value.replace(/--(accent-foreground|accent|muted)(?![\w-])/g, "--silk-$1")
}
