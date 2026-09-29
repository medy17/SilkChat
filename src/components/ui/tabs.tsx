import { Tabs as HeroTabs } from "@heroui/react"
import type { ComponentProps, ReactNode } from "react"

type Props = Omit<ComponentProps<typeof HeroTabs>, "onSelectionChange"> & {
    value?: string
    defaultValue?: string
    onValueChange?: (value: string) => void
    activationMode?: "automatic" | "manual"
}
export function Tabs({ value, defaultValue, onValueChange, activationMode, ...props }: Props) {
    return (
        <HeroTabs
            {...props}
            selectedKey={value}
            defaultSelectedKey={defaultValue}
            onSelectionChange={(key) => onValueChange?.(String(key))}
            keyboardActivation={activationMode}
        />
    )
}
export function TabsList(props: ComponentProps<typeof HeroTabs.List>) {
    return <HeroTabs.List {...props} />
}
export function TabsTrigger({
    value,
    disabled,
    children,
    ...props
}: Omit<ComponentProps<typeof HeroTabs.Tab>, "id" | "children"> & { children?: ReactNode } & {
    value: string
    disabled?: boolean
}) {
    return (
        <HeroTabs.Tab {...props} id={value} isDisabled={disabled}>
            {children}
            <HeroTabs.Indicator />
        </HeroTabs.Tab>
    )
}
export function TabsContent({
    value,
    forceMount,
    ...props
}: Omit<ComponentProps<typeof HeroTabs.Panel>, "id"> & { value: string; forceMount?: boolean }) {
    return <HeroTabs.Panel {...props} id={value} shouldForceMount={forceMount} />
}
