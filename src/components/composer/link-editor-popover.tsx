import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import type { PromptLinkDraft } from "@/lib/prompt-markdown"
import { useId, useRef, useState } from "react"
import { createPortal } from "react-dom"

export type LinkEditorAnchor = { top: number; left: number; width: number; height: number }

export function LinkEditorPopover({
    anchor,
    side,
    draft,
    onSave,
    onRemove,
    onDismiss
}: {
    anchor: LinkEditorAnchor
    side: "top" | "bottom"
    draft: PromptLinkDraft
    onSave: (link: { text: string; url: string }) => void
    onRemove: () => void
    // `refocus` is false when the user clicked elsewhere, so focus stays where they went.
    onDismiss: (refocus: boolean) => void
}) {
    const [text, setText] = useState(draft.text)
    const [url, setUrl] = useState(draft.url)
    const textRef = useRef<HTMLInputElement>(null)
    const urlRef = useRef<HTMLInputElement>(null)
    const canSave = url.trim().length > 0
    const textId = useId()
    const urlId = useId()

    return (
        <Popover open>
            {createPortal(
                <PopoverAnchor asChild>
                    <div aria-hidden="true" className="pointer-events-none fixed" style={anchor} />
                </PopoverAnchor>,
                document.body
            )}
            <PopoverContent
                side={side}
                sideOffset={12}
                className="w-72 p-3"
                onOpenAutoFocus={() => {
                    // A selected URL already fills the URL field, so start on the text.
                    const target = url && !text ? textRef : urlRef
                    target.current?.focus()
                    target.current?.select()
                }}
                onEscapeKeyDown={() => onDismiss(true)}
                onInteractOutside={() => onDismiss(false)}
            >
                <form
                    className="flex flex-col gap-3"
                    onSubmit={(event) => {
                        event.preventDefault()
                        if (canSave) onSave({ text, url })
                    }}
                >
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor={textId}>Title</Label>
                        <Input
                            ref={textRef}
                            id={textId}
                            value={text}
                            onChange={(event) => setText(event.target.value)}
                            className="h-8"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor={urlId}>URL</Label>
                        <Input
                            ref={urlRef}
                            id={urlId}
                            value={url}
                            onChange={(event) => setUrl(event.target.value)}
                            className="h-8"
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        {draft.existing && (
                            <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
                                Remove
                            </Button>
                        )}
                        <Button type="submit" size="sm" disabled={!canSave}>
                            Save
                        </Button>
                    </div>
                </form>
            </PopoverContent>
        </Popover>
    )
}
