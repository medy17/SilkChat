import original from "../threads/sidebar-shortcuts-helper.stories"
export { Playground } from "../threads/sidebar-shortcuts-helper.stories"
export default {
    ...original,
    title: "UI/Responsive popover",
    parameters: {
        ...original.parameters,
        docs: {
            description: { component: "Actual keyboard-shortcuts popover from the sidebar footer." }
        }
    }
}
