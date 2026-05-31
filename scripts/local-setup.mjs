import { spawn } from "node:child_process"

const LOCAL_MINIO_ALIAS = "local"
const LOCAL_MINIO_URL = "http://127.0.0.1:9000"
const LOCAL_MINIO_ACCESS_KEY = "minioadmin"
const LOCAL_MINIO_SECRET_KEY = "minioadmin"
const LOCAL_R2_BUCKET = "intern3-user-files"

const run = (label, command, args, { allowFailure = false } = {}) =>
    new Promise((resolve, reject) => {
        console.log(`\n[local-setup] ${label}`)
        const child = spawn(command, args, {
            stdio: "inherit",
            shell: process.platform === "win32"
        })

        child.on("exit", (code) => {
            if (code === 0) {
                resolve()
                return
            }
            if (allowFailure) {
                console.warn(`[local-setup] ${label} skipped (exit code ${code}).`)
                resolve()
                return
            }
            reject(new Error(`${label} failed with exit code ${code}`))
        })
    })

const runInMinioClient = (label, script) =>
    run(
        label,
        "docker",
        [
            "run",
            "--rm",
            "--entrypoint",
            "/bin/sh",
            "--network",
            "host",
            "minio/mc",
            "-lc",
            script
        ]
    )

const main = async () => {
    await run(
        "Starting Docker services (MinIO)",
        "docker",
        ["compose", "up", "-d"]
    )

    await runInMinioClient(
        "Configuring local MinIO bucket for public asset reads",
        [
            `mc alias set ${LOCAL_MINIO_ALIAS} ${LOCAL_MINIO_URL} ${LOCAL_MINIO_ACCESS_KEY} ${LOCAL_MINIO_SECRET_KEY}`,
            `mc anonymous set download ${LOCAL_MINIO_ALIAS}/${LOCAL_R2_BUCKET}`,
            `mc anonymous get ${LOCAL_MINIO_ALIAS}/${LOCAL_R2_BUCKET}`
        ].join(" && ")
    )

    await run(
        "Configuring Convex local deployment (one-time, interactive)",
        "bunx",
        [
            "convex",
            "dev",
            "--configure",
            "existing",
            "--dev-deployment",
            "local",
            "--local-force-upgrade",
            "--once",
            "--codegen",
            "disable",
            "--typecheck",
            "disable"
        ],
        { allowFailure: true }
    )

    console.log("\n[local-setup] Done. Run `bun run local:dev` to start app + local Convex.")
}

main().catch((error) => {
    console.error(`\n[local-setup] ${error.message}`)
    process.exit(1)
})
