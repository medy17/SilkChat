import original from "../persona-avatar.stories"
export { Playground } from "../persona-avatar.stories"
export default {
    ...original,
    title: "UI/avatar",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component: "Actual persona avatar as used in chat and the persona selector."
            }
        }
    }
}
