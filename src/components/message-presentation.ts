// Shared by the live message surface and the Persona editor's format preview.
export const MESSAGE_MARKDOWN_CLASS =
    "prose relative max-w-none prose-pre:bg-transparent prose-pre:p-0 [font-weight:450] prose-headings:font-semibold prose-strong:font-medium prose-pre:text-foreground leading-7 [&_.ignore-pre-bg>div]:bg-transparent [&_pre>div]:border-0.5 [&_pre>div]:border-border [&_pre>div]:bg-background"

export const USER_MESSAGE_BUBBLE_CLASS =
    "my-12 ml-auto w-fit max-w-[min(28rem,100%)] rounded-[var(--radius-md)] border border-border bg-user-message px-4 py-2 text-user-message-foreground has-[[data-message-code-block]]:w-full"
