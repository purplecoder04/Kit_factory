import { spawn, execFile } from "node:child_process"
import fs from "node:fs/promises"
import net from "node:net"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import { PDFDocument } from "pdf-lib"
import { chromium } from "playwright"

const execFileAsync = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const samplePath = path.join(root, "samples", "golden-kit.md")
const startedServerUrl = process.env.KIT_FACTORY_TEST_URL
let serverProcess

async function main() {
  const baseUrl = startedServerUrl || (await existingServerUrl()) || (await startServer())
  const markdown = await fs.readFile(samplePath, "utf8")

  await testDashboardSelectors(baseUrl)
  await testParserDefaults(baseUrl, markdown)
  await testSplitPdfOutputs(baseUrl, markdown)
  await testFillableFields(baseUrl, markdown)
  await testMockupOutput(baseUrl, markdown)
  await testBrandPackage(baseUrl, markdown)
  await testMeetAtTheHealPackage(baseUrl)

  console.log("Kit Factory regression smoke tests passed.")
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

async function testDashboardSelectors(baseUrl) {
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await page.goto(baseUrl, { waitUntil: "networkidle" })

    await expectVisible(page.getByText("Branch", { exact: true }).first(), "Branch selector label")
    await expectVisible(page.getByText("Design Preset", { exact: true }).first(), "Design Preset selector label")

    const selectTriggers = page.locator("button").filter({
      hasText: /Brand Signature|Split|Parse|Generate/i,
    })
    const triggerCount = await selectTriggers.count()

    assert(triggerCount >= 3, "Dashboard controls did not render as expected.")
  } finally {
    await browser.close()
  }
}

async function testParserDefaults(baseUrl, markdown) {
  const withoutDesignPreset = markdown.replace(/^design_preset:.*\r?\n/m, "")
  const payload = await postJson(baseUrl, "/api/parse", {
    markdown: withoutDesignPreset,
    branch: "land",
    outputMode: "split",
  })

  assert(payload.kit.branch === "land", `Expected branch land, got ${payload.kit.branch}.`)
  assert(payload.kit.designPreset === "land", `Expected land default preset, got ${payload.kit.designPreset}.`)
  assert(payload.issues.every((issue) => issue.level !== "error"), "Parser returned blocking errors.")

  const lessonPage = payload.kit.pages.find((page) => page.type === "lesson")
  const reflectionPage = payload.kit.pages.find((page) => page.type === "lesson-continue")
  const checklistPage = payload.kit.pages.find((page) => page.type === "checklist")
  const progressPage = payload.kit.pages.find((page) => page.type === "progress-check")
  const resourcePage = payload.kit.pages.find((page) => page.type === "resource")

  assert(lessonPage?.content.some((block) => block.type === "key-term"), "KEY_TERM was not parsed on lesson page.")
  assert(reflectionPage?.reflects.length === 1, "REFLECT field was not parsed.")
  assert(checklistPage?.checks.length >= 3, "CHECK fields were not parsed on checklist page.")
  assert(progressPage?.content.some((block) => block.type === "check-list"), "Progress CHECK fields were not parsed as non-fillable checks.")
  assert(resourcePage?.content.some((block) => block.type === "key-term"), "Resource KEY_TERM was not parsed.")
}

async function testSplitPdfOutputs(baseUrl, markdown) {
  const complete = await postBuffer(baseUrl, "/api/render", {
    markdown,
    branch: "brand",
    designPreset: "brand",
    outputMode: "all-in-one",
    target: "complete",
  })
  const guide = await postBuffer(baseUrl, "/api/render", {
    markdown,
    branch: "brand",
    designPreset: "brand",
    outputMode: "split",
    target: "guide",
  })
  const workbook = await postBuffer(baseUrl, "/api/render", {
    markdown,
    branch: "brand",
    designPreset: "brand",
    outputMode: "split",
    target: "workbook",
  })

  assert((await pageCount(complete)) === 19, "Complete PDF should include every page in the proof kit.")
  assert((await pageCount(guide)) === 14, "Lesson guide should include cover, guide pages, and closing page.")
  assert((await pageCount(workbook)) === 7, "Workbook PDF should include cover, workbook pages, and closing page.")
}

async function testFillableFields(baseUrl, markdown) {
  const fillable = await postBuffer(baseUrl, "/api/fillable", {
    markdown,
    branch: "brand",
    designPreset: "brand",
    outputMode: "split",
    target: "workbook",
  })
  const pdf = await PDFDocument.load(fillable)
  const fields = pdf.getForm().getFields()
  const fieldCount = fields.length
  const firstCheckbox = fields.find((field) => field.getName().includes("check_01"))
  const firstCheckboxRect = firstCheckbox?.acroField?.getWidgets?.()[0]?.getRectangle?.()

  assert(fieldCount >= 30, `Expected fillable workbook fields, got ${fieldCount}.`)
  assert(firstCheckboxRect, "Expected a fillable checklist checkbox field.")
  assert(
    firstCheckboxRect.x > 60 && firstCheckboxRect.x < 85,
    `Checklist checkbox should align to the designed box, got x=${firstCheckboxRect.x}.`
  )
}

async function testMockupOutput(baseUrl, markdown) {
  const mockup = await postBuffer(baseUrl, "/api/mockup", {
    markdown,
    branch: "meetatheal",
    designPreset: "meetatheal",
    outputMode: "split",
  })

  assert(mockup.length > 100_000, "Mockup PNG is unexpectedly small.")
  assert(mockup[0] === 0x89 && mockup[1] === 0x50 && mockup[2] === 0x4e && mockup[3] === 0x47, "Mockup is not a PNG.")
}

async function testBrandPackage(baseUrl, markdown) {
  const zip = await postBuffer(baseUrl, "/api/package/brand", {
    markdown,
  })
  const zipText = zip.toString("latin1")
  const filenames = [
    "brand-complete.pdf",
    "brand-land-complete.pdf",
  ]

  assert(zip.length > 100_000, "Brand package ZIP is unexpectedly small.")
  for (const filename of filenames) {
    assert(zipText.includes(filename), `Brand package ZIP is missing ${filename}.`)
  }
}

async function testMeetAtTheHealPackage(baseUrl) {
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
  const zipText = zip.toString("latin1")
  const filenames = [
    "meet-at-the-heal-lesson-book.pdf",
    "meet-at-the-heal-couples-workbook.pdf",
    "meet-at-the-heal-rise-individual-workbook.pdf",
    "meet-at-the-heal-land-individual-workbook.pdf",
  ]

  assert(zip.length > 100_000, "Meet at the Heal package ZIP is unexpectedly small.")
  for (const filename of filenames) {
    assert(zipText.includes(filename), `Package ZIP is missing ${filename}.`)
  }
}

async function postJson(baseUrl, route, body) {
  const response = await fetch(new URL(route, baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`${route} failed with status ${response.status}: ${await response.text()}`)
  }

  return response.json()
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

async function pageCount(pdfBuffer) {
  const pdf = await PDFDocument.load(pdfBuffer)
  return pdf.getPageCount()
}

async function expectVisible(locator, label) {
  await waitFor(async () => locator.isVisible(), `${label} was not visible.`)
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
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
