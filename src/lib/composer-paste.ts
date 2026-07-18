export const isComposerPasteTarget = (
    activeElement: Element | null,
    composerElement: HTMLTextAreaElement | null
) => Boolean(composerElement && activeElement === composerElement)
