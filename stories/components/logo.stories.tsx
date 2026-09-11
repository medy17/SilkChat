import type { Meta, StoryObj } from "@storybook/react-vite"
import { Logo, LogoMark, LibraryLogo, RoleplayWordmark } from "@/components/logo"
const meta = {
    title: "Brand/Logos",
    tags: ["autodocs"],
    render: () => (
        <div className="flex flex-col items-start gap-10">
            <Logo className="size-16" />
            <LogoMark className="h-5 w-auto" />
            <LibraryLogo className="h-5 w-auto" />
            <RoleplayWordmark className="h-12 max-w-full" />
        </div>
    ),
    parameters: {
        docs: {
            description: {
                component:
                    "App symbol, sidebar product marks, and the persona landing wordmark. All inherit theme colors."
            }
        }
    }
} satisfies Meta
export default meta
export const ProductMarks: StoryObj<typeof meta> = {}
