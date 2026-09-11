import type { Meta, StoryObj } from "@storybook/react-vite"
import * as C from "@/components/ui/radio-group"

const meta = {
    title: "UI/radio-group",
    parameters: {
        docs: {
            description: { component: "threads/thread-item-dialogs.tsx Move to Folder choices." }
        }
    },
    render: () => (
        <C.RadioGroup defaultValue="no-folder">
            <label htmlFor="no-folder" className="flex items-center space-x-2">
                <C.RadioGroupItem id="no-folder" value="no-folder" />
                <span>No Folder</span>
            </label>
            <label htmlFor="research" className="flex items-center space-x-2">
                <C.RadioGroupItem id="research" value="research" />
                <span>Research</span>
            </label>
        </C.RadioGroup>
    )
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
