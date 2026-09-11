import original from "../codeblock.stories"
export { Mermaid } from "../codeblock.stories"
export default {
    ...original,
    title: "UI/dropdown-menu",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component:
                    "The code block's real export controls. Mermaid previews expose format choices."
            }
        }
    }
}
