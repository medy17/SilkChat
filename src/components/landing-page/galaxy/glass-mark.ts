import {
    CanvasTexture,
    DirectionalLight,
    ExtrudeGeometry,
    Mesh,
    MeshBasicMaterial,
    MeshPhysicalMaterial,
    NeutralToneMapping,
    PerspectiveCamera,
    PlaneGeometry,
    PMREMGenerator,
    PointLight,
    Scene,
    SRGBColorSpace,
    WebGLRenderer
} from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js"
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js"

import { LOGO_SYMBOL_PATH, LOGO_SYMBOL_VIEWBOX } from "@/components/logo"

import type { GlassMark } from "./engine"
import { seededRandom } from "./field"
import { type GalaxyPalette, rgba } from "./palette"

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i
const BACKPLATE_SIZE = 384
const BACKPLATE_SPAN = 4.2
const BACKPLATE_Z = -1.1
const CAMERA_FOV = 28
const CAMERA_Z = 5.4
const MARK_HEIGHT = 1.15

const createRenderer = (canvas: HTMLCanvasElement) => {
    try {
        const renderer = new WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
            failIfMajorPerformanceCaveat: true
        })
        const gl = renderer.getContext()
        const debug = gl.getExtension("WEBGL_debug_renderer_info")
        const name = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER)
        if (typeof name === "string" && SOFTWARE_RENDERER.test(name)) {
            renderer.dispose()
            renderer.forceContextLoss()
            return null
        }
        return renderer
    } catch {
        return null
    }
}

const createMarkGeometry = () => {
    const [, , viewWidth, viewHeight] = LOGO_SYMBOL_VIEWBOX.split(" ").map(Number)
    const { paths } = new SVGLoader().parse(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_SYMBOL_VIEWBOX}"><path fill="#000" d="${LOGO_SYMBOL_PATH}"/></svg>`
    )
    const unit = MARK_HEIGHT / Math.max(viewWidth ?? 1, viewHeight ?? 1)
    // The mark is drawn in thin strokes, so the bevel stays narrow enough not to eat them.
    const extruded = new ExtrudeGeometry(
        paths.flatMap((path) => SVGLoader.createShapes(path)),
        {
            depth: 0.16 / unit,
            curveSegments: 24,
            bevelEnabled: true,
            bevelThickness: 0.025 / unit,
            bevelSize: 0.018 / unit,
            bevelOffset: -0.018 / unit,
            bevelSegments: 8
        }
    )
    const geometry = toCreasedNormals(extruded, (30 * Math.PI) / 180)
    extruded.dispose()
    geometry.scale(unit, unit, unit)
    geometry.rotateX(Math.PI)
    geometry.center()
    return geometry
}

// What the glass refracts when the galaxy behind it is sparse: a soft vignette and a
// scatter of specks.
const paintBackplateBase = ({ isDark, background, foreground }: GalaxyPalette) => {
    const canvas = document.createElement("canvas")
    canvas.width = BACKPLATE_SIZE
    canvas.height = BACKPLATE_SIZE
    const context = canvas.getContext("2d")
    if (!context) return canvas
    const half = BACKPLATE_SIZE / 2
    context.fillStyle = rgba(background, 1)
    context.fillRect(0, 0, BACKPLATE_SIZE, BACKPLATE_SIZE)
    const vignette = context.createRadialGradient(half, half, 0, half, half, half)
    vignette.addColorStop(0, rgba(foreground, isDark ? 0.1 : 0.02))
    vignette.addColorStop(1, rgba(foreground, isDark ? 0.02 : 0.28))
    context.fillStyle = vignette
    context.fillRect(0, 0, BACKPLATE_SIZE, BACKPLATE_SIZE)
    const random = seededRandom(7)
    for (let i = 0; i < 160; i++) {
        const angle = random() * Math.PI * 2
        const radius = BACKPLATE_SIZE * (0.12 + 0.36 * Math.sqrt(random()))
        context.fillStyle = rgba(
            foreground,
            (isDark ? 0.75 : 0.5) * (1 - (radius / (BACKPLATE_SIZE * 0.48)) * 0.5)
        )
        context.beginPath()
        context.arc(
            half + Math.cos(angle) * radius,
            half + Math.sin(angle) * radius,
            (1.4 + 2.6 * random()) * 0.375,
            0,
            Math.PI * 2
        )
        context.fill()
    }
    return canvas
}

export function createGlassMark(): GlassMark | null {
    const canvas = document.createElement("canvas")
    const renderer = createRenderer(canvas)
    if (!renderer) return null

    try {
        renderer.setPixelRatio(1)
        renderer.toneMapping = NeutralToneMapping

        const scene = new Scene()
        const pmrem = new PMREMGenerator(renderer)
        const room = new RoomEnvironment()
        scene.environment = pmrem.fromScene(room, 0.02).texture
        room.dispose()

        const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.1, 20)
        camera.position.set(0, 0, CAMERA_Z)

        const material = new MeshPhysicalMaterial({
            transmission: 1,
            thickness: 1.4,
            ior: 2,
            roughness: 0.02,
            color: 0xffffff,
            attenuationColor: 0xf2f6ff,
            metalness: 0,
            clearcoat: 1,
            clearcoatRoughness: 0.02,
            iridescence: 0.2,
            iridescenceIOR: 1.3,
            iridescenceThicknessRange: [120, 420],
            attenuationDistance: 2.5,
            specularIntensity: 1,
            envMapIntensity: 1.5,
            dispersion: 24,
            transparent: true,
            opacity: 0.72
        })
        const mesh = new Mesh(createMarkGeometry(), material)
        scene.add(mesh)

        // The backplate shows the galaxy through the glass. It draws only into the
        // transmission pass, so it is refracted but never seen directly.
        const plateCanvas = document.createElement("canvas")
        plateCanvas.width = BACKPLATE_SIZE
        plateCanvas.height = BACKPLATE_SIZE
        const plateContext = plateCanvas.getContext("2d")
        const plateTexture = new CanvasTexture(plateCanvas)
        plateTexture.colorSpace = SRGBColorSpace
        const plateMaterial = new MeshBasicMaterial({ map: plateTexture, toneMapped: false })
        const plate = new Mesh(new PlaneGeometry(BACKPLATE_SPAN, BACKPLATE_SPAN), plateMaterial)
        plate.position.z = BACKPLATE_Z
        plate.onBeforeRender = (webgl) => {
            plate.geometry.setDrawRange(0, webgl.getRenderTarget() ? Number.POSITIVE_INFINITY : 0)
        }
        scene.add(plate)

        const key = new PointLight(0xffffff, 6, 10)
        key.position.set(1.8, 1.6, 3.4)
        const fill = new PointLight(0xffffff, 3, 10)
        fill.position.set(-2, -1, 3)
        const rim = new DirectionalLight(0xffffff, 1.5)
        rim.position.set(-3, 1, -2)
        scene.add(key, fill, rim)

        let base: HTMLCanvasElement | null = null
        let baseIsDark: boolean | null = null
        let baseKey = ""
        let size = 0
        let frame = 0

        return {
            canvas,
            render: ({ px, t, faceX, faceY, spinX, spinY, palette, paint }) => {
                const nextSize = Math.max(64, 64 * Math.ceil(px / 64))
                if (nextSize !== size) {
                    size = nextSize
                    renderer.setSize(size, size, false)
                }
                const paletteKey = `${palette.background.join()}|${palette.foreground.join()}|${palette.isDark}`
                if (paletteKey !== baseKey) {
                    baseKey = paletteKey
                    base = paintBackplateBase(palette)
                    plateContext?.drawImage(base, 0, 0)
                    plateTexture.needsUpdate = true
                }
                if (palette.isDark !== baseIsDark) {
                    baseIsDark = palette.isDark
                    material.attenuationColor.set(palette.isDark ? 0xf2f6ff : 0xd6dde8)
                    material.attenuationDistance = palette.isDark ? 3 : 1.3
                    material.opacity = palette.isDark ? 0.88 : 0.96
                    material.envMapIntensity = palette.isDark ? 1.6 : 1.2
                    key.intensity = palette.isDark ? 5 : 3
                    fill.intensity = palette.isDark ? 2 : 1.2
                    rim.intensity = palette.isDark ? 2 : 0.8
                }

                const phase = 0.5 * t
                mesh.rotation.y = -0.06 + 0.5 * faceX + 0.14 * Math.cos(phase) + spinY
                mesh.rotation.x = 0.04 + 0.3 * faceY + spinX
                mesh.rotation.z = 0.08 * Math.sin(phase)

                // Repaint what the glass refracts every other frame.
                frame += 1
                if (base && plateContext && frame % 2 === 0) {
                    plateContext.drawImage(base, 0, 0)
                    paint(plateContext, BACKPLATE_SIZE)
                    plateTexture.needsUpdate = true
                }
                renderer.render(scene, camera)
            },
            dispose: () => {
                plateTexture.dispose()
                plateMaterial.dispose()
                plate.geometry.dispose()
                mesh.geometry.dispose()
                material.dispose()
                scene.environment?.dispose()
                pmrem.dispose()
                renderer.dispose()
                renderer.forceContextLoss()
            }
        }
    } catch {
        renderer.dispose()
        renderer.forceContextLoss()
        return null
    }
}
