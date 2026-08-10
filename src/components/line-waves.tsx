import { Mesh, Program, Renderer, Triangle } from "ogl"
import { useEffect, useRef } from "react"
import "./line-waves.css"

type LineWavesProps = {
    speed?: number
    innerLineCount?: number
    outerLineCount?: number
    warpIntensity?: number
    rotation?: number
    edgeFadeWidth?: number
    colorCycleSpeed?: number
    brightness?: number
    color1?: string
    color2?: string
    color3?: string
    preserveDrawingBuffer?: boolean
}

function hexToVec3(hex: string): [number, number, number] {
    const normalized = hex.replace("#", "")
    return [
        Number.parseInt(normalized.slice(0, 2), 16) / 255,
        Number.parseInt(normalized.slice(2, 4), 16) / 255,
        Number.parseInt(normalized.slice(4, 6), 16) / 255
    ]
}

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}`

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform float uSpeed;
uniform float uInnerLines;
uniform float uOuterLines;
uniform float uWarpIntensity;
uniform float uRotation;
uniform float uEdgeFadeWidth;
uniform float uColorCycleSpeed;
uniform float uBrightness;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

#define HALF_PI 1.5707963

float hashF(float n) {
  return fract(sin(n * 127.1) * 43758.5453123);
}

float smoothNoise(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hashF(i), hashF(i + 1.0), u);
}

float displaceA(float coord, float t) {
  float result = sin(coord * 2.123) * 0.2;
  result += sin(coord * 3.234 + t * 4.345) * 0.1;
  result += sin(coord * 0.589 + t * 0.934) * 0.5;
  return result;
}

float displaceB(float coord, float t) {
  float result = sin(coord * 1.345) * 0.3;
  result += sin(coord * 2.734 + t * 3.345) * 0.2;
  result += sin(coord * 0.189 + t * 0.934) * 0.3;
  return result;
}

vec2 rotate2D(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

void main() {
  vec2 coords = gl_FragCoord.xy / uResolution.xy;
  coords = rotate2D(coords * 2.0 - 1.0, uRotation);

  float halfT = uTime * uSpeed * 0.5;
  float fullT = uTime * uSpeed;
  vec2 fieldA = vec2(
    coords.x + displaceA(coords.y, halfT) * uWarpIntensity,
    coords.y - displaceA(coords.x * cos(fullT) * 1.235, halfT) * uWarpIntensity
  );
  vec2 fieldB = vec2(
    coords.x + displaceB(coords.y, halfT) * uWarpIntensity,
    coords.y - displaceB(coords.x * sin(fullT) * 1.235, halfT) * uWarpIntensity
  );
  vec2 blended = mix(fieldA, fieldB, mix(fieldA, fieldB, 0.5));

  float fadeTop = smoothstep(uEdgeFadeWidth, uEdgeFadeWidth + 0.4, blended.y);
  float fadeBottom = smoothstep(-uEdgeFadeWidth, -(uEdgeFadeWidth + 0.4), blended.y);
  float vMask = 1.0 - max(fadeTop, fadeBottom);
  float tileCount = mix(uOuterLines, uInnerLines, vMask);
  float scaledY = blended.y * tileCount;
  float nY = smoothNoise(abs(scaledY));
  float ridge = pow(
    step(abs(nY - blended.x) * 2.0, HALF_PI) * cos(2.0 * (nY - blended.x)),
    5.0
  );

  float lines = 0.0;
  for (float i = 1.0; i < 3.0; i += 1.0) {
    lines += pow(max(fract(scaledY), fract(-scaledY)), i * 2.0);
  }

  float pattern = vMask * lines;
  float cycleT = fullT * uColorCycleSpeed;
  float rChannel = (pattern + lines * ridge) * (cos(blended.y + cycleT * 0.234) * 0.5 + 1.0);
  float gChannel = (pattern + vMask * ridge) * (sin(blended.x + cycleT * 1.745) * 0.5 + 1.0);
  float bChannel = (pattern + lines * ridge) * (cos(blended.x + cycleT * 0.534) * 0.5 + 1.0);
  vec3 col = (rChannel * uColor1 + gChannel * uColor2 + bChannel * uColor3) * uBrightness;
  gl_FragColor = vec4(col, clamp(length(col), 0.0, 1.0));
}`

export function LineWaves({
    speed = 0.3,
    innerLineCount = 32,
    outerLineCount = 36,
    warpIntensity = 1,
    rotation = -45,
    edgeFadeWidth = 0,
    colorCycleSpeed = 1,
    brightness = 0.2,
    color1 = "#ffffff",
    color2 = "#ffffff",
    color3 = "#ffffff",
    preserveDrawingBuffer = false
}: LineWavesProps) {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const renderer = new Renderer({
            alpha: true,
            premultipliedAlpha: false,
            preserveDrawingBuffer
        })
        const gl = renderer.gl
        gl.clearColor(0, 0, 0, 0)

        const geometry = new Triangle(gl)
        const program = new Program(gl, {
            vertex: vertexShader,
            fragment: fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uResolution: { value: [1, 1, 1] },
                uSpeed: { value: speed },
                uInnerLines: { value: innerLineCount },
                uOuterLines: { value: outerLineCount },
                uWarpIntensity: { value: warpIntensity },
                uRotation: { value: (rotation * Math.PI) / 180 },
                uEdgeFadeWidth: { value: edgeFadeWidth },
                uColorCycleSpeed: { value: colorCycleSpeed },
                uBrightness: { value: brightness },
                uColor1: { value: hexToVec3(color1) },
                uColor2: { value: hexToVec3(color2) },
                uColor3: { value: hexToVec3(color3) }
            }
        })
        const mesh = new Mesh(gl, { geometry, program })

        function resize() {
            renderer.setSize(container?.offsetWidth ?? 1, container?.offsetHeight ?? 1)
            program.uniforms.uResolution.value = [
                gl.canvas.width,
                gl.canvas.height,
                gl.canvas.width / gl.canvas.height
            ]
        }

        container.appendChild(gl.canvas)
        resize()
        window.addEventListener("resize", resize)

        let animationFrameId = 0
        function update(time: number) {
            program.uniforms.uTime.value = time * 0.001
            renderer.render({ scene: mesh })
            animationFrameId = requestAnimationFrame(update)
        }
        animationFrameId = requestAnimationFrame(update)

        return () => {
            cancelAnimationFrame(animationFrameId)
            window.removeEventListener("resize", resize)
            if (gl.canvas.parentNode === container) container.removeChild(gl.canvas)
            gl.getExtension("WEBGL_lose_context")?.loseContext()
        }
    }, [
        speed,
        innerLineCount,
        outerLineCount,
        warpIntensity,
        rotation,
        edgeFadeWidth,
        colorCycleSpeed,
        brightness,
        color1,
        color2,
        color3,
        preserveDrawingBuffer
    ])

    return <div ref={containerRef} className="line-waves-container" />
}
