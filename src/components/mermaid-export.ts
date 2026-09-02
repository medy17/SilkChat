export const prepareMermaidSvg = (svg: string) => {
    const root = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement

    if (root.tagName.toLowerCase() !== "svg") {
        throw new Error("The Mermaid output did not contain an SVG")
    }

    root.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    root.setAttribute("width", "100%")
    root.setAttribute("height", "100%")
    root.style.display = "block"
    root.style.maxWidth = "none"
    return new XMLSerializer().serializeToString(root)
}

const getSvgDimensions = (svg: string) => {
    const root = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement
    const viewBox = root.getAttribute("viewBox")?.trim().split(/\s+/).map(Number)

    if (
        viewBox?.length === 4 &&
        Number.isFinite(viewBox[2]) &&
        Number.isFinite(viewBox[3]) &&
        viewBox[2] > 0 &&
        viewBox[3] > 0
    ) {
        return { width: viewBox[2], height: viewBox[3] }
    }

    const width = Number.parseFloat(root.getAttribute("width") ?? "")
    const height = Number.parseFloat(root.getAttribute("height") ?? "")

    return {
        width: Number.isFinite(width) && width > 0 ? width : 1200,
        height: Number.isFinite(height) && height > 0 ? height : 800
    }
}

export const mermaidSvgBlob = (svg: string) =>
    new Blob([prepareMermaidSvg(svg)], { type: "image/svg+xml;charset=utf-8" })

export const mermaidSvgToPng = async (svg: string) => {
    const normalizedSvg = prepareMermaidSvg(svg)
    const { width, height } = getSvgDimensions(normalizedSvg)
    const scale = Math.min(2, 4096 / width, 4096 / height)
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))

    const image = new Image()
    const objectUrl = URL.createObjectURL(
        new Blob([normalizedSvg], { type: "image/svg+xml;charset=utf-8" })
    )

    try {
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve()
            image.onerror = () => reject(new Error("Unable to rasterize the Mermaid diagram"))
            image.src = objectUrl
        })

        const context = canvas.getContext("2d")
        if (!context) throw new Error("Canvas rendering is unavailable")
        context.drawImage(image, 0, 0, canvas.width, canvas.height)

        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob)
                else reject(new Error("Unable to create a PNG image"))
            }, "image/png")
        })
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

export const downloadBlob = (blob: Blob, filename: string) => {
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = objectUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
}
