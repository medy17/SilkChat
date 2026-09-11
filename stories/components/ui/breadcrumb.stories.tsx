import type { Meta, StoryObj } from "@storybook/react-vite"
import * as C from "@/components/ui/breadcrumb"

const meta = {
    title: "Available primitives/Breadcrumb",
    parameters: { layout: "padded" },
    render: () => (
        <C.Breadcrumb>
            <C.BreadcrumbList>
                <C.BreadcrumbItem>
                    <C.BreadcrumbLink href="#projects">Projects</C.BreadcrumbLink>
                </C.BreadcrumbItem>
                <C.BreadcrumbSeparator />
                <C.BreadcrumbItem>
                    <C.BreadcrumbPage>Research</C.BreadcrumbPage>
                </C.BreadcrumbItem>
            </C.BreadcrumbList>
        </C.Breadcrumb>
    )
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
export const UnusedInApp: Story = {
    parameters: {
        docs: {
            description: {
                story: "No current app call site. This is an available primitive API example, not a SilkChat screen."
            }
        }
    }
}
