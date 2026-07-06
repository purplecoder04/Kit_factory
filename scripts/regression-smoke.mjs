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
const meetAtTheHealSampleDir = path.join(root, "samples", "meet-at-the-heal-package")
const startedServerUrl = process.env.KIT_FACTORY_TEST_URL
let serverProcess

async function main() {
  const baseUrl = startedServerUrl || (await startServer())
  const markdown = await fs.readFile(samplePath, "utf8")
  const meetAtTheHealPackage = await loadMeetAtTheHealPackageSamples()

  await runStep("dashboard selectors", () => testDashboardSelectors(baseUrl))
  await runStep("storage readiness endpoint", () => testStorageReadinessEndpoint(baseUrl))
  await runStep("storage setup SQL endpoint", () => testStorageSetupSqlEndpoint(baseUrl))
  await runStep("parser defaults", () => testParserDefaults(baseUrl, markdown))
  await runStep("ready-to-sell public export guard", () => testReadyRequiresPublicExport(baseUrl, markdown))
  const savedExportHistoryKit = await runStep("saved export history", () =>
    testSavedExportHistory(baseUrl, meetAtTheHealPackage)
  )
  if (savedExportHistoryKit) {
    await runStep("dashboard export history panel", () =>
      testDashboardExportHistoryPanel(baseUrl, savedExportHistoryKit)
    )
  }
  await runStep("split PDF outputs", () => testSplitPdfOutputs(baseUrl, markdown))
  await runStep("fillable fields", () => testFillableFields(baseUrl, markdown))
  await runStep("mockup output", () => testMockupOutput(baseUrl, markdown))
  await runStep("Brand package", () => testBrandPackage(baseUrl, markdown))
  await runStep("Meet at the Heal package", () =>
    testMeetAtTheHealPackage(baseUrl, meetAtTheHealPackage)
  )

  console.log("Kit Factory regression smoke tests passed.")
}

async function runStep(label, action) {
  process.stdout.write(`- ${label}... `)
  const result = await action()
  console.log("ok")
  return result
}

async function loadMeetAtTheHealPackageSamples() {
  return {
    couplesWorkbookMarkdown: await fs.readFile(
      path.join(meetAtTheHealSampleDir, "meetatheal-couples-workbook.md"),
      "utf8"
    ),
    landWorkbookMarkdown: await fs.readFile(
      path.join(meetAtTheHealSampleDir, "meetatheal-land-individual-workbook.md"),
      "utf8"
    ),
    lessonBookMarkdown: await fs.readFile(
      path.join(meetAtTheHealSampleDir, "meetatheal-lesson-book.md"),
      "utf8"
    ),
    riseWorkbookMarkdown: await fs.readFile(
      path.join(meetAtTheHealSampleDir, "meetatheal-rise-individual-workbook.md"),
      "utf8"
    ),
  }
}

async function startServer() {
  const port = await findOpenPort()
  const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next")
  const baseUrl = `http://127.0.0.1:${port}`
  console.log(`Starting Kit Factory test server at ${baseUrl}`)

  serverProcess = spawn(process.execPath, ["--use-system-ca", nextCli, "dev", "-p", String(port), "--hostname", "127.0.0.1"], {
    cwd: root,
    env: {
      ...process.env,
      KIT_FACTORY_SKIP_STORAGE_UPLOAD: "1",
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
      const response = await fetchWithTimeout(baseUrl, {}, 5_000)
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

async function isHealthyUrl(url) {
  try {
    const response = await fetchWithTimeout(url, {}, 5_000)
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
    await expectVisible(page.getByTestId("sidebar-new-kit"), "New Kit sidebar action")
    await expectVisible(page.getByTestId("sidebar-all-kits"), "All Kits sidebar action")
    await expectVisible(page.getByText("Export History", { exact: true }), "Export History panel")
    await expectVisible(page.getByRole("button", { name: /Copy Latest/i }), "Copy Latest Link action")
    await expectVisible(page.getByRole("button", { name: /Copy All/i }), "Copy All Links action")
    await expectVisible(page.getByRole("button", { name: /Check Storage/i }), "Storage readiness action")
    await expectVisible(page.getByRole("button", { name: /Copy Setup SQL/i }), "Storage setup SQL action")
    await expectVisible(page.getByText("No linked Product yet."), "Ready-to-sell product status")

    const selectTriggers = page.locator("button").filter({
      hasText: /Brand Signature|Split|Parse|Generate/i,
    })
    const triggerCount = await selectTriggers.count()

    assert(triggerCount >= 3, "Dashboard controls did not render as expected.")

    await page.getByTestId("sidebar-all-kits").click()
    await expectVisible(page.getByText(/saved kit[s]? in Supabase/i), "All Kits library view")
    await expectVisible(page.getByTestId("all-kits-search"), "All Kits search input")

    await page.getByTestId("sidebar-new-kit").click()
    await expectVisible(page.getByText("New kit started."), "New Kit status message")

    const markdownSource = page.getByLabel("Markdown source")
    const markdownValue = await markdownSource.inputValue()

    assert(markdownValue.includes("title: Untitled Kit"), "New Kit did not load a fresh markdown template.")
    assert(markdownValue.includes("design_preset: brand"), "New Kit did not reset to the default Brand preset.")
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
    persist: false,
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

async function testReadyRequiresPublicExport(baseUrl, markdown) {
  const uniqueMarkdown = markdown.replace(
    /^title:.*$/m,
    `title: Ready Guard Smoke ${Date.now()}`
  )
  const payload = await postJson(baseUrl, "/api/parse", {
    markdown: uniqueMarkdown,
    branch: "brand",
    designPreset: "brand",
    outputMode: "split",
    persist: true,
  })

  if (!payload.kitId) {
    return
  }

  const response = await fetchWithTimeout(new URL(`/api/kits/${payload.kitId}/ready`, baseUrl), {
    method: "POST",
  }, 60_000)
  const body = await response.json()

  assert(response.status === 409, `Ready-to-sell fallback guard returned ${response.status}, expected 409.`)
  assert(body.code === "missing_public_export", `Expected missing_public_export, got ${body.code}.`)
  assert(
    /public export/i.test(body.error || ""),
    "Ready-to-sell fallback guard did not explain that a public export is required."
  )
}

async function testSavedExportHistory(baseUrl, meetAtTheHealPackage) {
  const timestamp = Date.now()
  const brandKitName = `Export History Smoke ${timestamp}`
  const brandMarkdown = createExportHistoryMarkdown(brandKitName)
  const brandPayload = await postJson(baseUrl, "/api/parse", {
    markdown: brandMarkdown,
    branch: "brand",
    designPreset: "brand",
    outputMode: "split",
    persist: true,
  })

  if (!brandPayload.kitId) {
    return
  }

  await postBuffer(baseUrl, "/api/render", {
    markdown: brandMarkdown,
    branch: "brand",
    designPreset: "brand",
    outputMode: "split",
    target: "guide",
    kitId: brandPayload.kitId,
  })
  await postBuffer(baseUrl, "/api/render", {
    markdown: brandMarkdown,
    branch: "brand",
    designPreset: "brand",
    outputMode: "split",
    target: "workbook",
    kitId: brandPayload.kitId,
  })
  await postBuffer(baseUrl, "/api/fillable", {
    markdown: brandMarkdown,
    branch: "brand",
    designPreset: "brand",
    outputMode: "split",
    target: "workbook",
    kitId: brandPayload.kitId,
  })
  await postBuffer(baseUrl, "/api/mockup", {
    markdown: brandMarkdown,
    branch: "brand",
    designPreset: "brand",
    outputMode: "split",
    kitId: brandPayload.kitId,
  })
  await postBuffer(baseUrl, "/api/package/brand", {
    markdown: brandMarkdown,
    kitId: brandPayload.kitId,
  })

  const brandHistory = await getJson(baseUrl, `/api/kits/${brandPayload.kitId}/exports`)
  assertExportHistoryIncludes(brandHistory.exports, [
    "pdf:guide",
    "pdf:workbook",
    "fillable:workbook",
    "mockup",
    "zip:brand-package",
  ], "Brand saved kit")
  const savedKit = {
    brandKitId: brandPayload.kitId,
    brandKitName,
  }

  const lessonBookMarkdown = meetAtTheHealPackage.lessonBookMarkdown.replace(
    /^title:.*$/m,
    `title: Meet at the Heal Lesson Book Smoke ${timestamp}`
  )
  const mathPayload = await postJson(baseUrl, "/api/parse", {
    markdown: lessonBookMarkdown,
    branch: "meetatheal",
    designPreset: "meetatheal",
    outputMode: "all-in-one",
    persist: true,
  })

  if (!mathPayload.kitId) {
    return savedKit
  }

  await postBuffer(baseUrl, "/api/package/meetatheal", {
    lessonBookMarkdown,
    couplesWorkbookMarkdown: meetAtTheHealPackage.couplesWorkbookMarkdown,
    riseWorkbookMarkdown: meetAtTheHealPackage.riseWorkbookMarkdown,
    landWorkbookMarkdown: meetAtTheHealPackage.landWorkbookMarkdown,
    kitId: mathPayload.kitId,
  })

  const mathHistory = await getJson(baseUrl, `/api/kits/${mathPayload.kitId}/exports`)
  assertExportHistoryIncludes(mathHistory.exports, [
    "zip:meetatheal-package",
  ], "Meet at the Heal saved kit")

  return savedKit
}

async function testDashboardExportHistoryPanel(baseUrl, savedKit) {
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await page.goto(baseUrl, { waitUntil: "networkidle" })

    await page.getByTestId("sidebar-all-kits").click()
    await page.getByTestId("all-kits-search").fill(savedKit.brandKitName)

    const savedKitButton = page.getByTestId(`all-kits-open-${savedKit.brandKitId}`)
    await expectVisible(savedKitButton, "Saved kit with exports")
    await savedKitButton.click()

    await expectVisible(page.getByText("Saved kit opened."), "saved kit opened message")
    await expectVisible(page.getByText("5 saved files"), "saved export count")
    await expectVisible(page.getByText("pdf / guide", { exact: true }), "lesson guide export type")
    await expectVisible(page.getByText("pdf / workbook", { exact: true }), "workbook export type")
    await expectVisible(page.getByText("fillable / workbook", { exact: true }), "fillable export type")
    await expectVisible(page.getByText("mockup", { exact: true }), "mockup export type")
    await expectVisible(page.getByText("zip / brand package", { exact: true }), "Brand ZIP export type")

    await page.getByRole("button", { name: /Copy Latest/i }).click()
    await expectVisible(
      page.getByText(/Local fallback copied|Latest export link copied|Links are ready below/i),
      "Copy Latest feedback"
    )

    await page.getByRole("button", { name: /Copy All/i }).click()
    await expectVisible(
      page.getByText(/Export list copied|All export links copied|Links are ready below/i),
      "Copy All feedback"
    )

    await page.getByRole("button", { name: /Mark Ready/i }).click()
    await expectVisible(
      page.getByText(/Generate a public export after Supabase Storage is ready/i),
      "ready-to-sell public export warning"
    )
  } finally {
    await browser.close()
  }
}

async function testStorageReadinessEndpoint(baseUrl) {
  const response = await fetchWithTimeout(new URL("/api/storage/check", baseUrl), {
    method: "POST",
  }, 60_000)
  const body = await response.json()

  assert(
    response.status === 200 || response.status === 409,
    `Storage check returned ${response.status}, expected 200 or 409.`
  )
  assert(typeof body.bucket === "string" && body.bucket.length > 0, "Storage check did not report a bucket.")
  assert(typeof body.ok === "boolean", "Storage check did not report ok as a boolean.")
  assert(typeof body.step === "string" && body.step.length > 0, "Storage check did not report a step.")
  assert(
    response.status === (body.ok ? 200 : 409),
    "Storage check HTTP status did not match the ok flag."
  )

  if (!body.ok) {
    assert(typeof body.issue === "string" && body.issue.length > 0, "Storage check failure did not explain the issue.")
  }
}

async function testStorageSetupSqlEndpoint(baseUrl) {
  const payload = await getJson(baseUrl, "/api/storage/setup-sql")

  assert(typeof payload.sql === "string", "Storage setup SQL endpoint did not return SQL text.")
  assert(payload.sql.includes("insert into storage.buckets"), "Storage setup SQL is missing the bucket setup.")
  assert(payload.sql.includes("Kit Factory public export reads"), "Storage setup SQL is missing the public read policy.")
  assert(payload.sql.includes("Kit Factory anon export uploads"), "Storage setup SQL is missing the upload policy.")
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
  assert((await pageCount(workbook)) === 8, "Workbook PDF should include cover, intro, workbook pages, and closing page.")
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

async function testMeetAtTheHealPackage(baseUrl, meetAtTheHealPackage) {
  const zip = await postBuffer(baseUrl, "/api/package/meetatheal", {
    lessonBookMarkdown: meetAtTheHealPackage.lessonBookMarkdown,
    couplesWorkbookMarkdown: meetAtTheHealPackage.couplesWorkbookMarkdown,
    riseWorkbookMarkdown: meetAtTheHealPackage.riseWorkbookMarkdown,
    landWorkbookMarkdown: meetAtTheHealPackage.landWorkbookMarkdown,
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

async function getJson(baseUrl, route) {
  const response = await fetchWithTimeout(new URL(route, baseUrl), {}, 60_000)

  if (!response.ok) {
    throw new Error(`${route} failed with status ${response.status}: ${await response.text()}`)
  }

  return response.json()
}

async function postJson(baseUrl, route, body) {
  const response = await fetchWithTimeout(new URL(route, baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, 60_000)

  if (!response.ok) {
    throw new Error(`${route} failed with status ${response.status}: ${await response.text()}`)
  }

  return response.json()
}

async function postBuffer(baseUrl, route, body) {
  const response = await fetchWithTimeout(new URL(route, baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, 120_000)

  if (!response.ok) {
    throw new Error(`${route} failed with status ${response.status}: ${await response.text()}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30_000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
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

function createExportHistoryMarkdown(title) {
  return `---
title: ${title}
subtitle: Saved export history proof
branch: brand
design_preset: brand
product_type: workbook
output_mode: split
author: Best Collective
tagline: One system. Five rooms. All for you.
---

<!-- PAGE: cover -->

TITLE: Export History Smoke
SUBTITLE: Saved export history proof
TAGLINE: One system. Five rooms. All for you.
ICON: branch-default
IMAGE_SLOT: cover-lifestyle

<!-- PAGE: welcome -->

TITLE: Welcome

This compact sample keeps the saved export history test fast.

CHECK: Parse a saved kit.
CHECK: Export the files.
CHECK: Show the links in history.

<!-- PAGE: lesson -->

SECTION: Lesson 01
TITLE: Saved Exports

This page proves the guide export can attach to a saved kit.

KEY_TERM: Export History
KEY_TERM_BODY: The saved list of files generated for one kit.

CHECK: Confirm the kit exists.
CHECK: Confirm the file rows exist.

<!-- PAGE: workbook -->

SECTION: Workbook
TITLE: Saved Export Prompt

PROMPT: What file should I copy first?
PROMPT: What package is ready to share?

<!-- PAGE: checklist -->

SECTION: Checklist
TITLE: Export Checklist

CHECK: Lesson guide saved.
CHECK: Workbook saved.
CHECK: Fillable saved.

<!-- PAGE: closing -->

TITLE: Export History Complete
SUBTITLE: Links are ready when storage is ready.
TAGLINE: Best Collective
`
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertExportHistoryIncludes(exports, expectedTypes, label) {
  assert(Array.isArray(exports), `${label} export history did not return a list.`)

  for (const expectedType of expectedTypes) {
    const match = exports.find((file) => file.fileType === expectedType)

    assert(match, `${label} export history is missing ${expectedType}.`)
    assert(typeof match.filename === "string" && match.filename.length > 0, `${expectedType} is missing a filename.`)
    assert(typeof match.fileUrl === "string" && match.fileUrl.length > 0, `${expectedType} is missing a file URL.`)
    assert(typeof match.status === "string" && match.status.length > 0, `${expectedType} is missing a status.`)
    assert(typeof match.createdAt === "string" && match.createdAt.length > 0, `${expectedType} is missing a date.`)
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
  .finally(async () => {
    await stopServer()
    process.exit(process.exitCode ?? 0)
  })
