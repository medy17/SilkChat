import type { Meta, StoryObj } from "@storybook/react-vite"
import * as Icons from "@/components/brand-icons"
const meta = {
    title: "Brand/Icons",
    tags: ["autodocs"],
    render: () => (
        <div className="flex flex-wrap gap-8">
            {Object.entries(Icons).map(([name, Icon]) => (
                <div key={name} className="flex items-center gap-3">
                    <Icon className="size-6" />
                    <span>{name}</span>
                </div>
            ))}
        </div>
    ),
    parameters: {
        docs: {
            description: {
                component:
                    "Provider, tool and reasoning icons used by model pickers, chat controls and landing content."
            }
        }
    }
} satisfies Meta
export default meta
export const Catalog: StoryObj<typeof meta> = {}
