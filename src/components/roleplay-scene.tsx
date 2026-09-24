import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    dialogueText,
    escapeHtmlOutsideCode,
    ROLEPLAY_USER_ID,
    type RoleplayNode,
    type TravelMode,
    travelMode
} from "@/lib/roleplay"
import { matchRoleplayPersona } from "@/lib/roleplay-persona"
import { getFileThumbnailSources } from "@/lib/generated-image-urls"
import { getPersonaAvatarSrc } from "./persona-avatar"
import {
    RoleplayPersonaContext,
    RoleplayPortraitsContext,
    RoleplayUserImageContext
} from "./roleplay-persona-context"
import { Carriage, DragonWing, HorseHead, Ufo, UnicornHead } from "./roleplay-travel-icons"
import {
    Accessibility,
    Ambulance,
    Bike,
    Brain,
    Bus,
    CableCar,
    Car,
    CarTaxiFront,
    Caravan,
    Drone,
    Feather,
    Footprints,
    Ghost,
    Hand,
    Helicopter,
    History,
    type LucideIcon,
    Motorbike,
    Mountain,
    MountainSnow,
    Plane,
    Rocket,
    Route,
    Sailboat,
    Scooter,
    Ship,
    Tractor,
    TrainFront,
    TrainFrontTunnel,
    TramFront,
    Truck,
    WandSparkles,
    Waves,
    WavesArrowDown
} from "lucide-react"
import { type ReactNode, useContext, useId } from "react"
import "@/styles/roleplay.css"

const travelIcons: Record<TravelMode | "unknown", LucideIcon> = {
    foot: Footprints,
    car: Car,
    taxi: CarTaxiFront,
    truck: Truck,
    bus: Bus,
    ambulance: Ambulance,
    tractor: Tractor,
    caravan: Caravan,
    bike: Bike,
    motorbike: Motorbike,
    scooter: Scooter,
    wheelchair: Accessibility,
    train: TrainFront,
    tram: TramFront,
    subway: TrainFrontTunnel,
    cableCar: CableCar,
    boat: Sailboat,
    ship: Ship,
    swim: Waves,
    dive: WavesArrowDown,
    plane: Plane,
    helicopter: Helicopter,
    drone: Drone,
    wings: Feather,
    spacecraft: Rocket,
    ufo: Ufo,
    magic: WandSparkles,
    ghost: Ghost,
    climb: Mountain,
    ski: MountainSnow,
    horse: HorseHead,
    unicorn: UnicornHead,
    dragon: DragonWing,
    carriage: Carriage,
    unknown: Route
}

// Gutter shorthand for the beat type; the hover label teaches it without cluttering reading.
function Device({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
    return (
        <span className="rp-device" title={label} aria-hidden="true">
            <Icon size={14} strokeWidth={1.5} />
        </span>
    )
}

type Props = {
    nodes: RoleplayNode[]
    renderMarkdown: (content: string, isAnimating: boolean) => ReactNode
    streaming?: boolean
    avatars?: Readonly<Record<string, string>>
}

// Only the beat still receiving tokens needs streaming Markdown treatment.
function lastBeat(nodes: RoleplayNode[]): RoleplayNode | undefined {
    const node = nodes.at(-1)
    return node && "children" in node ? (lastBeat(node.children) ?? node) : node
}

const initialsOf = (name: string) =>
    name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => [...part][0])
        .join("")

export function RoleplayScene({ nodes, renderMarkdown, streaming = false, avatars }: Props) {
    const persona = useContext(RoleplayPersonaContext)
    const userImage = useContext(RoleplayUserImageContext)
    const portraits = useContext(RoleplayPortraitsContext)?.portraits
    const sceneId = useId()
    const animating = streaming ? lastBeat(nodes) : undefined
    const markdown = (node: RoleplayNode & { text: string }, text = node.text) =>
        renderMarkdown(escapeHtmlOutsideCode(text), node === animating)

    // Thread portraits render at avatar size, so they load as small thumbnails.
    const portraitSrc = (id: string | undefined) => {
        const portrait = id ? portraits?.find((entry) => entry.characterId === id) : undefined
        return portrait ? getFileThumbnailSources(portrait.storageKey).src : undefined
    }

    function renderNode(node: RoleplayNode, key: string): ReactNode {
        if (node.kind === "character") {
            const matchedPersona = matchRoleplayPersona(node.id, persona)
            const name = matchedPersona?.name ?? node.name
            // The user keeps the character's in-story name; only the portrait is theirs.
            const avatar = matchedPersona
                ? getPersonaAvatarSrc(matchedPersona.avatarKind, matchedPersona.avatarValue)
                : node.id === ROLEPLAY_USER_ID
                  ? userImage
                  : node.id && avatars && Object.hasOwn(avatars, node.id)
                    ? avatars[node.id]
                    : portraitSrc(node.id)
            const nameId = `${sceneId}-${key}`
            const portrait = (
                <Avatar className="rp-character-avatar" aria-hidden="true">
                    {avatar && (
                        <AvatarImage src={avatar} alt="" className="rp-character-portrait" />
                    )}
                    <AvatarFallback className="rp-character-initials">
                        {initialsOf(name)}
                    </AvatarFallback>
                </Avatar>
            )
            if (node.compact) {
                // Quick exchange: portrait beside the bubbles, name inside the first one.
                // Stays hidden until a line has text so a row never appears empty.
                const firstLine = node.children.find(
                    (child) => child.kind === "dialogue" && child.text.trim()
                )
                if (!firstLine) return null
                return (
                    <div key={key} role="group" aria-labelledby={nameId} className="rp-exchange">
                        {portrait}
                        <div className="rp-exchange-lines">
                            {node.children.map((child, index) =>
                                child.kind === "dialogue"
                                    ? child.text.trim() && (
                                          <div
                                              key={`${key}-${index}`}
                                              className="rp-beat rp-dialogue"
                                          >
                                              {child === firstLine && (
                                                  <span id={nameId} className="rp-exchange-name">
                                                      {name}
                                                  </span>
                                              )}
                                              {markdown(child, dialogueText(child.text))}
                                          </div>
                                      )
                                    : renderNode(child, `${key}-${index}`)
                            )}
                        </div>
                    </div>
                )
            }
            return (
                <div key={key} role="group" aria-labelledby={nameId} className="rp-character">
                    <div className="rp-character-header">
                        {portrait}
                        <span id={nameId} className="rp-character-name">
                            {name}
                        </span>
                    </div>
                    <div className="rp-character-beats">
                        {node.children.map((child, index) => renderNode(child, `${key}-${index}`))}
                    </div>
                </div>
            )
        }
        if (node.kind === "flashback") {
            return (
                <div key={key} role="group" aria-label="Flashback" className="rp-beat rp-flashback">
                    <Device icon={History} label="Flashback" />
                    <div className="rp-flashback-body">
                        {node.children.map((child, index) => renderNode(child, `${key}-${index}`))}
                    </div>
                </div>
            )
        }
        if (!node.text.trim()) return null
        return (
            <div key={key} className={`rp-beat rp-${node.kind}`}>
                {node.kind === "action" && <Device icon={Hand} label="Action" />}
                {node.kind === "move" && (
                    <Device
                        icon={travelIcons[travelMode(node.via) ?? "unknown"]}
                        label={
                            node.via === "foot"
                                ? "On foot"
                                : node.via
                                  ? node.via[0].toUpperCase() + node.via.slice(1)
                                  : "Travel"
                        }
                    />
                )}
                {node.kind === "thought" && (
                    <>
                        <Device icon={Brain} label="Thought" />
                        <span className="sr-only">Thinks: </span>
                    </>
                )}
                {node.kind === "dialogue" && <span className="sr-only">Says: </span>}
                {markdown(node, node.kind === "dialogue" ? dialogueText(node.text) : node.text)}
            </div>
        )
    }

    return (
        <div
            role="group"
            aria-label="Roleplay scene"
            className="roleplay-scene not-prose"
            data-roleplay-scene
        >
            {nodes.map((node, index) => renderNode(node, String(index)))}
        </div>
    )
}
