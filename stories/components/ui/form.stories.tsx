import original from "../themes/import-theme-dialog.stories"
export { Playground } from "../themes/import-theme-dialog.stories"
export default {
    ...original,
    title: "UI/Form",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component:
                    "The theme import form is the current React Hook Form composition. Submit an empty URL to see validation."
            }
        }
    }
}
