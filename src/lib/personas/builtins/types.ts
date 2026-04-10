export type BuiltInPersonaDoc = {
    fileName: string
    content: string
}

export type BuiltInPersona = {
    id: string
    name: string
    shortName: string
    description: string
    instructions: string
    conversationStarters: string[]
    defaultModelId: string
    avatarPath: string
    knowledgeDocs: BuiltInPersonaDoc[]
}
