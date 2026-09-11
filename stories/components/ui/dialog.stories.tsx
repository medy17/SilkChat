import original from "../threads/thread-item-dialogs.stories"
export { Playground } from "../threads/thread-item-dialogs.stories"
export default {
    ...original,
    title: "UI/Dialog",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component: "Thread rename, move, and delete dialogs from SidebarDialogsContainer."
            }
        }
    }
}
