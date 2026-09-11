export const createPdf = (pageCount: number, name = "report.pdf", type = "application/pdf") => {
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        `<< /Type /Pages /Count ${pageCount} /Kids [${Array.from({ length: pageCount }, (_, i) => `${i + 3} 0 R`).join(" ")}] >>`,
        ...Array.from(
            { length: pageCount },
            () => "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>"
        )
    ]
    let content = "%PDF-1.7\n"
    const offsets = [0]
    objects.forEach((object, index) => {
        offsets.push(content.length)
        content += `${index + 1} 0 obj\n${object}\nendobj\n`
    })
    const xrefOffset = content.length
    content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    content += offsets
        .slice(1)
        .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
        .join("")
    content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
    return new File([content], name, { type })
}
