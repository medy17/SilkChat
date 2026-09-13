"use client"

import { Canvas, useThree } from "@react-three/fiber"
import type { MotionValue } from "motion/react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { type Group, PMREMGenerator } from "three"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"

import { type SculptureKind, sculpturePose } from "@/lib/landing-sculpture"
import { createSculptureGeometries } from "@/lib/landing-sculpture-geometry"

type Props = {
    kind: SculptureKind
    progress: MotionValue<number>
    color: string
    onReady: () => void
    onFailure: () => void
}

function Sculpture({ kind, progress, color, onReady }: Omit<Props, "onFailure">) {
    const group = useRef<Group>(null)
    const readyFrame = useRef<number | null>(null)
    const { gl, scene, invalidate } = useThree()
    const geometries = useMemo(() => createSculptureGeometries(kind), [kind])

    useLayoutEffect(() => {
        const room = new RoomEnvironment()
        const generator = new PMREMGenerator(gl)
        const environment = generator.fromScene(room, 0.04)
        scene.environment = environment.texture
        invalidate()
        return () => {
            scene.environment = null
            environment.dispose()
            generator.dispose()
            room.dispose()
        }
    }, [gl, scene, invalidate])

    useLayoutEffect(() => {
        const update = () => {
            if (!group.current) return
            const pose = sculpturePose(kind, progress.get())
            group.current.rotation.set(pose.x, pose.y, pose.z)
            group.current.scale.setScalar(pose.scale)
            if (kind === "source") {
                group.current.children[0].position.x = -pose.spread
                group.current.children[1].position.x = pose.spread
            } else {
                group.current.children.forEach((part, index) => {
                    part.position.x = (index === 0 ? -1 : 1) * pose.spread
                    part.position.y = (index === 0 ? 0.5 : -0.5) * pose.spread
                })
            }
            invalidate()
        }
        update()
        return progress.on("change", update)
    }, [kind, progress, invalidate])

    // Reveal only after the posed, lit scene has actually drawn. Mounting the
    // canvas or constructing its environment doesn't mean a frame is ready.
    const onAfterRender = useCallback(() => {
        if (readyFrame.current !== null) return
        readyFrame.current = requestAnimationFrame(onReady)
    }, [onReady])
    useEffect(
        () => () => {
            if (readyFrame.current !== null) cancelAnimationFrame(readyFrame.current)
            readyFrame.current = null
        },
        []
    )

    useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries])

    const initialPose = sculpturePose(kind, progress.get())
    return (
        <group
            ref={group}
            rotation={[initialPose.x, initialPose.y, initialPose.z]}
            scale={initialPose.scale}
        >
            {geometries.map((geometry, index) => (
                <mesh
                    key={index}
                    geometry={geometry}
                    position={[
                        (index === 0 ? -1 : 1) * initialPose.spread,
                        kind === "source" ? 0 : (index === 0 ? 0.5 : -0.5) * initialPose.spread,
                        0
                    ]}
                    onAfterRender={onAfterRender}
                >
                    <meshPhysicalMaterial
                        color={color}
                        metalness={0.88}
                        roughness={0.24}
                        envMapIntensity={1.8}
                        clearcoat={0.35}
                        clearcoatRoughness={0.2}
                    />
                </mesh>
            ))}
        </group>
    )
}

export default function SculptureCanvas(props: Props) {
    return (
        <Canvas
            frameloop="demand"
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 7.7], fov: 37 }}
            gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
            onCreated={({ gl }) => {
                gl.domElement.addEventListener("webglcontextlost", props.onFailure, { once: true })
            }}
        >
            <ambientLight intensity={0.6} />
            <directionalLight position={[3, 5, 5]} intensity={3} />
            <directionalLight position={[-4, 1, 2]} intensity={1.3} />
            <Sculpture {...props} />
        </Canvas>
    )
}
