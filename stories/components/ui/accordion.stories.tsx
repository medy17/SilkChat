import type { Meta, StoryObj } from "@storybook/react-vite"
import * as C from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"

const meta = {
    title: "UI/accordion",
    parameters: {
        docs: {
            description: {
                component: "Library desktop filter accordion; option text is fixture data."
            }
        }
    },
    render: () => (
        <C.Accordion type="multiple" className="w-72">
            <C.AccordionItem value="models">
                <C.AccordionTrigger className="text-sm hover:no-underline">
                    Models
                </C.AccordionTrigger>
                <C.AccordionContent>
                    <label htmlFor="filter-model" className="flex items-center gap-2 py-2">
                        <Checkbox id="filter-model" />
                        Demo image model
                    </label>
                </C.AccordionContent>
            </C.AccordionItem>
        </C.Accordion>
    )
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
