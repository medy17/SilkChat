import original from "../threads/new-folder-button.stories"
export { Playground } from "../threads/new-folder-button.stories"
export default {
    ...original,
    title: "UI/Drawer",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component:
                    "NewFolderDialog switches to Drawer at mobile widths. Resize the preview to use the actual mobile composition."
            }
        }
    }
}
