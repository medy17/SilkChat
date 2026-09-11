import original from "../threads/sidebar-bulk-dialogs.stories"
export { Playground } from "../threads/sidebar-bulk-dialogs.stories"
export default {
    ...original,
    title: "UI/alert-dialog",
    parameters: {
        ...original.parameters,
        docs: { description: { component: "Actual bulk thread deletion confirmation." } }
    }
}
