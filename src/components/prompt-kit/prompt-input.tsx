import {
    PromptEditor,
    type PromptEditorHandle,
    type PromptEditorProps
} from "@/components/composer/prompt-editor"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type React from "react"
import { createContext, forwardRef, useContext } from "react"

type PromptInputContextType = {
    isLoading: boolean
    maxHeight: number | string
    onSubmit?: () => void
    disabled?: boolean
    disableKeyboardSubmit: boolean
    invertSendNewlineBehavior: boolean
}

const PromptInputContext = createContext<PromptInputContextType>({
    isLoading: false,
    maxHeight: 240,
    onSubmit: undefined,
    disabled: false,
    disableKeyboardSubmit: false,
    invertSendNewlineBehavior: false
})

function usePromptInput() {
    const context = useContext(PromptInputContext)
    if (!context) {
        throw new Error("usePromptInput must be used within a PromptInput")
    }
    return context
}

type PromptInputProps = {
    isLoading?: boolean
    maxHeight?: number | string
    onSubmit?: () => void
    disableKeyboardSubmit?: boolean
    invertSendNewlineBehavior?: boolean
    children: React.ReactNode
    className?: string
    style?: React.CSSProperties
}

const PromptInput = forwardRef<HTMLDivElement, PromptInputProps>(function PromptInput(
    {
        className,
        style,
        isLoading = false,
        maxHeight = 240,
        onSubmit,
        disableKeyboardSubmit = false,
        invertSendNewlineBehavior = false,
        children
    },
    ref
) {
    return (
        <TooltipProvider>
            <PromptInputContext.Provider
                value={{
                    isLoading,
                    maxHeight,
                    onSubmit,
                    disableKeyboardSubmit,
                    invertSendNewlineBehavior
                }}
            >
                <div
                    ref={ref}
                    data-slot="prompt-input-root"
                    className={cn(
                        "glass-composer rounded-[var(--radius-lg)] border p-3",
                        className
                    )}
                    style={style}
                >
                    {children}
                </div>
            </PromptInputContext.Provider>
        </TooltipProvider>
    )
})

export type PromptInputEditorProps = Omit<
    PromptEditorProps,
    "onSubmit" | "disableKeyboardSubmit" | "invertSendNewlineBehavior" | "maxHeight"
>

const PromptInputEditor = forwardRef<PromptEditorHandle, PromptInputEditorProps>(
    function PromptInputEditor(props, ref) {
        const { maxHeight, onSubmit, disabled, disableKeyboardSubmit, invertSendNewlineBehavior } =
            usePromptInput()
        return (
            <PromptEditor
                ref={ref}
                maxHeight={maxHeight}
                onSubmit={onSubmit}
                disableKeyboardSubmit={disableKeyboardSubmit}
                invertSendNewlineBehavior={invertSendNewlineBehavior}
                {...props}
                disabled={props.disabled ?? disabled}
            />
        )
    }
)

type PromptInputActionsProps = React.HTMLAttributes<HTMLDivElement>

function PromptInputActions({ children, className, ...props }: PromptInputActionsProps) {
    return (
        <div className={cn("flex items-center gap-2", className)} {...props}>
            {children}
        </div>
    )
}

type PromptInputActionProps = {
    className?: string
    tooltip: React.ReactNode
    children: React.ReactNode
    side?: "top" | "bottom" | "left" | "right"
} & React.ComponentProps<typeof Tooltip>

function PromptInputAction({
    tooltip,
    children,
    className,
    side = "top",
    ...props
}: PromptInputActionProps) {
    const { disabled } = usePromptInput()

    return (
        <Tooltip {...props}>
            <TooltipTrigger asChild disabled={disabled}>
                {children}
            </TooltipTrigger>
            <TooltipContent side={side} className={className}>
                {tooltip}
            </TooltipContent>
        </Tooltip>
    )
}

export { PromptInput, PromptInputEditor, PromptInputActions, PromptInputAction }
