import { Radio, RadioGroup } from "@heroui/react"
import { useEffect, useState, type ComponentProps, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Browsing with arrows must not commit a model/persona or close its picker. */
export function PickerChoices({
    value,
    ...props
}: Omit<ComponentProps<typeof RadioGroup>, "onChange">) {
    const [draft, setDraft] = useState(value)
    useEffect(() => setDraft(value), [value])
    return <RadioGroup {...props} value={draft} onChange={setDraft} />
}

export function PickerChoice({
    value,
    label,
    disabled,
    onCommit,
    className,
    children
}: {
    value: string
    label: string
    disabled?: boolean
    onCommit: () => void
    className?: string
    children: ReactNode
}) {
    return (
        <Radio
            value={value}
            isDisabled={disabled}
            aria-label={label}
            className={cn("mt-0 min-w-0", className)}
        >
            <Radio.Content
                className="flex w-full min-w-0 items-start rounded-md text-left font-normal outline-none data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-ring"
                render={(domProps) => (
                    // biome-ignore lint/a11y/noLabelWithoutControl: React Aria supplies the radio input in domProps.children.
                    <label
                        {...domProps}
                        onClickCapture={(event) => {
                            domProps.onClickCapture?.(event)
                            // The label forwards pointer clicks to the input. Commit that one event only.
                            if (!disabled && event.target instanceof HTMLInputElement) onCommit()
                        }}
                        onKeyDownCapture={(event) => {
                            domProps.onKeyDownCapture?.(event)
                            if (
                                !disabled &&
                                event.target instanceof HTMLInputElement &&
                                event.key === "Enter"
                            ) {
                                event.preventDefault()
                                onCommit()
                            }
                        }}
                    />
                )}
            >
                {children}
            </Radio.Content>
        </Radio>
    )
}
