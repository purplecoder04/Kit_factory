import { spawn, execFile } from "node:child_process"
import fs from "node:fs/promises"
import net from "node:net"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import { chromium } from "playwright"

const execFileAsync = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const samplePath = path.join(root, "samples", "golden-kit.md")
const outputRoot = path.join(root, "output", "visual-proof-pack", "latest")
const pdftoppmPath = process.env.PDFTOPPM_PATH || findBundledPdftoppm()
const startedServerUrl = process.env.KIT_FACTORY_TEST_URL
let serverProcess

const proofPresets = [
  {
    label: "Brand",
    branch: "brand",
    designPreset: "brand",
    slug: "brand",
    title: "Get Your Business Straight Kit",
    subtitle: "One System. Five Rooms. All For You.",
    tagline: "Your brand is your promise.",
  },
  {
    label: "Brand Land",
    branch: "brand",
    designPreset: "brand-land",
    slug: "brand-land",
    title: "Get Your Business Straight Kit",
    subtitle: "One System. Five Rooms. All For You.",
    tagline: "Your brand is your promise.",
  },
  {
    label: "Rise",
    branch: "rise",
    designPreset: "rise",
    slug: "rise",
    title: "Rise",
    subtitle: "Come Back To Yourself.",
    tagline: "You are becoming everything you prayed for.",
  },
  {
    label: "Land",
    branch: "land",
    designPreset: "land",
    slug: "land",
    title: "Land",
    subtitle: "Build. Grow. Stand Firm.",
    tagline: "You are building something that matters.",
  },
  {
    label: "Rebuild",
    branch: "rebuild",
    designPreset: "rebuild",
    slug: "rebuild",
    title: "Rebuild",
    subtitle: "New Season. New Story. New You.",
    tagline: "A new chapter starts here.",
  },
  {
    label: "Meet at the Heal",
    branch: "meetatheal",
    designPreset: "meetatheal",
    slug: "meetatheal",
    title: "Meet at the Heal",
    subtitle: "Two Worlds. One Choice. A Stronger We.",
    tagline: "We choose us, every day.",
  },
  {
    label: "Meet at the Heal Rise",
    branch: "meetatheal",
    designPreset: "meetatheal-rise",
    slug: "meetatheal-rise",
    title: "Meet at the Heal Rise Individual Workbook",
    subtitle: "Come Back To Yourself.",
    tagline: "Two worlds. One choice. A stronger we.",
  },
  {
    label: "Meet at the Heal Land",
    branch: "meetatheal",
    designPreset: "meetatheal-land",
    slug: "meetatheal-land",
    title: "Meet at the Heal Land Individual Workbook",
    subtitle: "Build. Grow. Stand Firm.",
    tagline: "Two worlds. One choice. A stronger we.",
  },
]

async function main() {
  const baseUrl = startedServerUrl || (await existingServerUrl()) || (await startServer())
  const sampleMarkdown = await fs.readFile(samplePath, "utf8")
  const dirs = await prepareOutput()
  const proofRows = []

  for (const preset of proofPresets) {
    const markdown = markdownForPreset(sampleMarkdown, preset)
    const pdfPath = path.join(dirs.pdfs, `${preset.slug}-complete.pdf`)
    const mockupPath = path.join(dirs.mockups, `${preset.slug}-mockup.png`)
    const pageDir = path.join(dirs.pages, preset.slug)

    await fs.mkdir(pageDir, { recursive: true })
    await writeBuffer(
      pdfPath,
      await postBuffer(baseUrl, "/api/render", {
        markdown,
        branch: preset.branch,
        designPreset: preset.designPreset,
        outputMode: "all-in-one",
        target: "complete",
      })
    )
    await writeBuffer(
      mockupPath,
      await postBuffer(baseUrl, "/api/mockup", {
        markdown,
        branch: preset.branch,
        designPreset: preset.designPreset,
        outputMode: "all-in-one",
      })
    )

    const pageImages = await renderPdfPages(pdfPath, pageDir)
    const coverPath = path.join(dirs.covers, `${preset.slug}-cover.png`)
    await fs.copyFile(pageImages[0], coverPath)

    const contactSheetPath = path.join(dirs.contactSheets, `${preset.slug}-contact.png`)
    await createImageGrid({
      title: `${preset.label} - Full PDF Contact Sheet`,
      images: pageImages.map((image, index) => ({
        label: `Page ${index + 1}`,
        path: image,
      })),
      outputPath: contactSheetPath,
      columns: 5,
      imageWidth: 220,
    })

    proofRows.push({
      ...preset,
      pdfPath,
      mockupPath,
      coverPath,
      contactSheetPath,
      pageCount: pageImages.length,
    })

    console.log(`Created proofs for ${preset.label}.`)
  }

  await createImageGrid({
    title: "Kit Factory Cover Overview",
    images: proofRows.map((row) => ({
      label: row.label,
      path: row.coverPath,
    })),
    outputPath: path.join(outputRoot, "cover-overview.png"),
    columns: 4,
    imageWidth: 250,
  })

  await createImageGrid({
    title: "Kit Factory Website Mockup Overview",
    images: proofRows.map((row) => ({
      label: row.label,
      path: row.mockupPath,
    })),
    outputPath: path.join(outputRoot, "mockup-overview.png"),
    columns: 2,
    imageWidth: 520,
  })

  await createMeetAtTheHealPackageProof(baseUrl, dirs.package)
  await writeReadme(baseUrl, proofRows)

  console.log(`Visual proof pack ready: ${outputRoot}`)
}

async function prepareOutput() {
  await fs.rm(outputRoot, { recursive: true, force: true })

  const dirs = {
    covers: path.join(outputRoot, "covers"),
    contactSheets: path.join(outputRoot, "contact-sheets"),
    mockups: path.join(outputRoot, "mockups"),
    package: path.join(outputRoot, "package"),
    pages: path.join(outputRoot, "pages"),
    pdfs: path.join(outputRoot, "pdfs"),
  }

  await Promise.all(Object.values(dirs).map((dir) => fs.mkdir(dir, { recursive: true })))

  return dirs
}

async function createMeetAtTheHealPackageProof(baseUrl, packageDir) {
  const zipPath = path.join(packageDir, "meet-at-the-heal-kit-package.zip")
  const zip = await postBuffer(baseUrl, "/api/package/meetatheal", {
    lessonBookMarkdown: createMeetAtTheHealMarkdown({
      title: "Meet at the Heal Lesson Book",
      subtitle: "Two Worlds. One Choice. A Stronger We.",
      designPreset: "meetatheal",
      pageType: "lesson",
    }),
    couplesWorkbookMarkdown: createMeetAtTheHealMarkdown({
      title: "Meet at the Heal Couples Workbook",
      subtitle: "Let's heal together.",
      designPreset: "meetatheal",
      pageType: "workbook",
    }),
    riseWorkbookMarkdown: createMeetAtTheHealMarkdown({
      title: "Meet at the Heal Rise Individual Workbook",
      subtitle: "Come back to yourself.",
      designPreset: "meetatheal-rise",
      pageType: "workbook",
    }),
    landWorkbookMarkdown: createMeetAtTheHealMarkdown({
      title: "Meet at the Heal Land Individual Workbook",
      subtitle: "Build. Grow. Stand Firm.",
      designPreset: "meetatheal-land",
      pageType: "workbook",
    }),
  })
  const expectedFiles = [
    "meet-at-the-heal-lesson-book.pdf",
    "meet-at-the-heal-couples-workbook.pdf",
    "meet-at-the-heal-rise-individual-workbook.pdf",
    "meet-at-the-heal-land-individual-workbook.pdf",
  ]
  const zipText = zip.toString("latin1")
  const missing = expectedFiles.filter((filename) => !zipText.includes(filename))

  if (missing.length > 0) {
    throw new Error(`Meet at the Heal package is missing: ${missing.join(", ")}`)
  }

  await writeBuffer(zipPath, zip)
  await fs.writeFile(
    path.join(packageDir, "package-summary.txt"),
    [
      "Meet at the Heal package proof",
      "",
      `ZIP: ${zipPath}`,
      `Size: ${zip.length} bytes`,
      "",
      "Files confirmed in ZIP:",
      ...expectedFiles.map((filename) => `- ${filename}`),
      "",
    ].join("\n")
  )
}

async function createImageGrid({ title, images, outputPath, columns, imageWidth }) {
  const browser = await chromium.launch({ headless: true })
  const gap = 26
  const cardWidth = imageWidth + 26
  const viewportWidth = columns * cardWidth + (columns - 1) * gap + 80
  const embeddedImages = await Promise.all(
    images.map(async (image) => ({
      ...image,
      src: await pngDataUri(image.path),
    }))
  )

  try {
    const page = await browser.newPage({ viewport: { width: viewportWidth, height: 1200 } })
    await page.setContent(buildGridHtml({ title, images: embeddedImages, columns, imageWidth, gap }), {
      waitUntil: "networkidle",
    })
    await page.screenshot({ path: outputPath, fullPage: true })
  } finally {
    await browser.close()
  }
}

function buildGridHtml({ title, images, columns, imageWidth, gap }) {
  const cards = images
    .map(
      (image) => `<figure>
        <img src="${image.src}" />
        <figcaption>${escapeHtml(image.label)}</figcaption>
      </figure>`
    )
    .join("")

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #f6f3ed;
        color: #222026;
        font-family: Arial, sans-serif;
        padding: 34px 40px 46px;
      }
      h1 {
        font-family: Georgia, serif;
        font-size: 34px;
        font-weight: 700;
        margin: 0 0 24px;
      }
      .grid {
        display: grid;
        gap: ${gap}px;
        grid-template-columns: repeat(${columns}, ${imageWidth + 26}px);
      }
      figure {
        background: rgba(255, 255, 255, 0.68);
        border: 1px solid rgba(79, 45, 104, 0.16);
        box-shadow: 0 18px 36px rgba(34, 32, 38, 0.14);
        margin: 0;
        padding: 13px;
      }
      img {
        display: block;
        width: ${imageWidth}px;
        height: auto;
      }
      figcaption {
        color: #4f2d68;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        line-height: 1.35;
        margin-top: 10px;
        text-transform: uppercase;
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <main class="grid">${cards}</main>
  </body>
</html>`
}

async function pngDataUri(imagePath) {
  const data = await fs.readFile(imagePath)

  return `data:image/png;base64,${data.toString("base64")}`
}

async function renderPdfPages(pdfPath, pageDir) {
  const prefix = path.join(pageDir, "page")

  await execFileAsync(pdftoppmPath, ["-png", "-r", "96", pdfPath, prefix])

  const files = await fs.readdir(pageDir)

  return files
    .filter((file) => file.endsWith(".png"))
    .sort((a, b) => pageNumber(a) - pageNumber(b))
    .map((file) => path.join(pageDir, file))
}

function pageNumber(file) {
  return Number(file.match(/-(\d+)\.png$/)?.[1] || 0)
}

async function writeReadme(baseUrl, rows) {
  const lines = [
    "# Kit Factory Visual Proof Pack",
    "",
    `Generated from: ${baseUrl}`,
    `Generated at: ${new Date().toISOString()}`,
    "",
    "## Start Here",
    "",
    "- `cover-overview.png` compares the first page for every preset.",
    "- `mockup-overview.png` compares the website mockup image for every preset.",
    "- `contact-sheets/` contains one full-PDF contact sheet per preset.",
    "- `package/package-summary.txt` confirms the Meet at the Heal package ZIP file names.",
    "",
    "## Presets",
    "",
    ...rows.map(
      (row) =>
        `- ${row.label}: ${row.pageCount} pages, PDF \`pdfs/${path.basename(
          row.pdfPath
        )}\`, mockup \`mockups/${path.basename(row.mockupPath)}\``
    ),
    "",
  ]

  await fs.writeFile(path.join(outputRoot, "README.md"), lines.join("\n"))
}

async function startServer() {
  const port = await findOpenPort()
  const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next")
  const baseUrl = `http://127.0.0.1:${port}`

  serverProcess = spawn(process.execPath, [nextCli, "dev", "-p", String(port), "--hostname", "127.0.0.1"], {
    cwd: root,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  let logs = ""
  serverProcess.stdout.on("data", (chunk) => {
    logs += chunk.toString()
  })
  serverProcess.stderr.on("data", (chunk) => {
    logs += chunk.toString()
  })

  try {
    await waitFor(async () => {
      const response = await fetch(baseUrl)
      return response.ok
    }, "Next dev server did not start.")
  } catch (error) {
    const fallbackUrl = nextConflictUrl(logs)

    if (fallbackUrl && (await isHealthyUrl(fallbackUrl))) {
      serverProcess = undefined
      return fallbackUrl
    }

    throw new Error(`${error.message}\n${logs}`)
  }

  return baseUrl
}

async function existingServerUrl() {
  const url = "http://localhost:3000"

  return (await isHealthyUrl(url)) ? url : ""
}

async function isHealthyUrl(url) {
  try {
    const response = await fetch(url)
    return response.ok
  } catch {
    return false
  }
}

function nextConflictUrl(logs) {
  const match = logs.match(/Local:\s+(http:\/\/localhost:\d+)/)

  return match?.[1] || ""
}

async function postBuffer(baseUrl, route, body) {
  const response = await fetch(new URL(route, baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`${route} failed with status ${response.status}: ${await response.text()}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

async function writeBuffer(filePath, buffer) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, buffer)
}

async function waitFor(check, failureMessage, timeoutMs = 60_000) {
  const start = Date.now()
  let lastError

  while (Date.now() - start < timeoutMs) {
    try {
      if (await check()) {
        return
      }
    } catch (error) {
      lastError = error
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(lastError ? `${failureMessage}\n${lastError.message}` : failureMessage)
}

async function findOpenPort() {
  const server = net.createServer()

  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })

  const address = server.address()
  await new Promise((resolve) => server.close(resolve))

  return address.port
}

function findBundledPdftoppm() {
  const candidate = path.join(
    process.env.USERPROFILE || "",
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "native",
    "poppler",
    "Library",
    "bin",
    process.platform === "win32" ? "pdftoppm.exe" : "pdftoppm"
  )

  return candidate
}

function markdownForPreset(source, preset) {
  const frontmatter = [
    "---",
    `title: ${preset.title}`,
    `subtitle: ${preset.subtitle}`,
    `branch: ${preset.branch}`,
    `design_preset: ${preset.designPreset}`,
    "product_type: workbook",
    "output_mode: all-in-one",
    "author: Best Collective",
    `tagline: ${preset.tagline}`,
    "---",
  ].join("\n")

  return source
    .replace(/^---\r?\n[\s\S]*?\r?\n---/, frontmatter)
    .replace(/(<!-- PAGE: cover -->[\s\S]*?TITLE: ).*/m, `$1${preset.title}`)
    .replace(/(<!-- PAGE: cover -->[\s\S]*?SUBTITLE: ).*/m, `$1${preset.subtitle}`)
    .replace(/(<!-- PAGE: cover -->[\s\S]*?TAGLINE: ).*/m, `$1${preset.tagline}`)
    .replace(/(<!-- PAGE: closing -->[\s\S]*?TITLE: ).*/m, `$1${closingTitle(preset)}`)
    .replace(/(<!-- PAGE: closing -->[\s\S]*?SUBTITLE: ).*/m, `$1${preset.subtitle}`)
    .replace(/(<!-- PAGE: closing -->[\s\S]*?TAGLINE: ).*/m, `$1${preset.tagline}`)
}

function closingTitle(preset) {
  if (preset.branch === "meetatheal") {
    return "Meet at the Heal"
  }

  if (preset.branch === "brand") {
    return "Best Collective"
  }

  return preset.title
}

function createMeetAtTheHealMarkdown({ title, subtitle, designPreset, pageType }) {
  const innerPage =
    pageType === "lesson"
      ? `<!-- PAGE: lesson -->

SECTION: Lesson 01
TITLE: Healing Together

This is the shared lesson space for the couple.

CHECK: Come back to us.
CHECK: Recognize the patterns.
CHECK: Communicate with care.

REFLECT: What would feel different if we chose repair instead of defense?

BOTTOM_NOTE: We choose us, every day.`
      : `<!-- PAGE: workbook -->

SECTION: Workbook
TITLE: Get Honest With You

PROMPT: What do I keep ignoring about myself?
PROMPT: What do I know deep down I deserve?
PROMPT: What support would help me show up with more honesty?

BOTTOM_NOTE: Healing starts with the truth we are brave enough to name.`

  return `---
title: ${title}
subtitle: ${subtitle}
branch: meetatheal
design_preset: ${designPreset}
product_type: workbook
output_mode: all-in-one
author: Best Collective
tagline: Two worlds. One choice. A stronger we.
---

<!-- PAGE: cover -->

TITLE: ${title}
SUBTITLE: ${subtitle}
TAGLINE: Two worlds. One choice. A stronger we.
ICON: branch-default
IMAGE_SLOT: cover-lifestyle

${innerPage}

<!-- PAGE: closing -->

TITLE: Meet at the Heal
SUBTITLE: Two Worlds. One Choice. A Stronger We.
TAGLINE: We choose us, every day.
ICON: branch-default
IMAGE_SLOT: closing-lifestyle
`
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

async function stopServer() {
  if (!serverProcess?.pid) {
    return
  }

  if (process.platform === "win32") {
    await execFileAsync("taskkill", ["/pid", String(serverProcess.pid), "/T", "/F"]).catch(() => {})
    return
  }

  serverProcess.kill("SIGTERM")
}

process.on("SIGINT", async () => {
  await stopServer()
  process.exit(130)
})

process.on("SIGTERM", async () => {
  await stopServer()
  process.exit(143)
})

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(stopServer)
