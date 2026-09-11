import type { Meta, StoryObj } from "@storybook/react-vite"
import * as C from "@/components/ui/pagination"

const meta = {
    title: "UI/Pagination",
    parameters: { layout: "padded" },
    render: () => (
        <C.Pagination>
            <C.PaginationContent>
                <C.PaginationItem>
                    <C.PaginationPrevious href="#previous" />
                </C.PaginationItem>
                <C.PaginationItem>
                    <C.PaginationLink href="#1" isActive>
                        1
                    </C.PaginationLink>
                </C.PaginationItem>
                <C.PaginationItem>
                    <C.PaginationLink href="#2">2</C.PaginationLink>
                </C.PaginationItem>
                <C.PaginationItem>
                    <C.PaginationEllipsis />
                </C.PaginationItem>
                <C.PaginationItem>
                    <C.PaginationNext href="#next" />
                </C.PaginationItem>
            </C.PaginationContent>
        </C.Pagination>
    )
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
