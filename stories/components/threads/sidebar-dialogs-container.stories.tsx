import type { Meta, StoryObj } from "@storybook/react-vite"
import { useRef } from "react"
import {
    SidebarDialogsContainer,
    type SidebarDialogsHandle
} from "@/components/threads/sidebar-dialogs-container"
import { Button } from "@/components/ui/button"
import { demoThread, demoProject } from "../../../.storybook/fixtures"
function Example() {
    const ref = useRef<SidebarDialogsHandle>(null)
    return (
        <>
            <div className="flex gap-3">
                <Button onClick={() => ref.current?.openRename(demoThread)}>Rename chat</Button>
                <Button onClick={() => ref.current?.openMove(demoThread)}>Move chat</Button>
                <Button variant="destructive" onClick={() => ref.current?.openDelete(demoThread)}>
                    Delete chat
                </Button>
            </div>
            <SidebarDialogsContainer ref={ref} projects={[demoProject]} />
        </>
    )
}
const meta = {
    title: "Sidebar/Dialog workflow",
    render: () => <Example />,
    parameters: {
        docs: {
            description: {
                component:
                    "threads-sidebar.tsx opens these dialogs through the same imperative handle. Fixture mutations keep changes inside the workshop."
            }
        }
    }
} satisfies Meta
export default meta
export const ThreadActions: StoryObj<typeof meta> = {}
