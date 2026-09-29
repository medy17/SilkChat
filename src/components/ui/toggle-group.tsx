import { ToggleButton, ToggleButtonGroup } from "@heroui/react"
import type { ComponentProps, ReactNode } from "react"
import { cn } from "@/lib/utils"

type SelectionProps =
    | {
          type?: "single"
          value?: string
          defaultValue?: string
          onValueChange?: (value: string) => void
      }
    | {
          type: "multiple"
          value?: string[]
          defaultValue?: string[]
          onValueChange?: (value: string[]) => void
      }
type Props = Omit<ComponentProps<typeof ToggleButtonGroup>, "onSelectionChange" | "children"> &
    SelectionProps & { children?: ReactNode; disabled?: boolean }
export function ToggleGroup({ disabled, children, className, ...props }: Props) {
    const { type = "single", value, defaultValue, onValueChange: _onValueChange, ...rest } = props
    const keys = (value: string | string[]) => (Array.isArray(value) ? value : value ? [value] : [])
    return (
        <ToggleButtonGroup
            isDetached
            size="sm"
            {...rest}
            className={cn(
                "gap-1 rounded-md bg-silk-muted p-1",
                typeof className === "string" && className
            )}
            isDisabled={disabled}
            selectionMode={type}
            disallowEmptySelection={type === "single"}
            selectedKeys={value === undefined ? undefined : keys(value)}
            defaultSelectedKeys={defaultValue === undefined ? undefined : keys(defaultValue)}
            onSelectionChange={(keys) => {
                if (props.type === "multiple") props.onValueChange?.([...keys].map(String))
                else {
                    const value = [...keys][0]
                    if (value !== undefined) props.onValueChange?.(String(value))
                }
            }}
        >
            {children}
        </ToggleButtonGroup>
    )
}
export function ToggleGroupItem({
    value,
    disabled,
    className,
    ...props
}: Omit<ComponentProps<typeof ToggleButton>, "id"> & { value: string; disabled?: boolean }) {
    return (
        <ToggleButton
            {...props}
            id={value}
            isDisabled={disabled}
            className={cn(
                "h-7 min-w-0 rounded-sm px-3 font-medium text-muted-foreground data-[selected=true]:bg-background data-[selected=true]:text-foreground data-[selected=true]:shadow-sm",
                typeof className === "string" && className
            )}
        />
    )
}
