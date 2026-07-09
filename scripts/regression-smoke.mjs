import { spawn, execFile } from "node:child_process"
import fs from "node:fs/promises"
import net from "node:net"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import { createClient } from "@supabase/supabase-js"
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
  await runStep("ready-to-sell public export reuse", () =>
    testReadyUsesPublicExportAndReusesProduct(baseUrl, markdown)
  )
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
  await runStep("Meet at the Heal package validation", () =>
    testMeetAtTheHealPackageValidation(baseUrl, meetAtTheHealPackage)
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

async function testReadyUsesPublicExportAndReusesProduct(baseUrl) {
  const supabase = smokeSupabaseClient()

  if (!supabase) {
    return
  }

  const title = `Ready Reuse Smoke ${Date.now()}`
  const readyMarkdown = createExportHistoryMarkdown(title)
  const payload = await postJson(baseUrl, "/api/parse", {
    markdown: readyMarkdown,
    branch: "brand",
    designPreset: "brand",
    outputMode: "split",
    persist: true,
  })

  if (!payload.kitId) {
    return
  }

  const publicUrl = `https://example.com/kit-factory/${payload.kitId}/ready-smoke.pdf`
  let productId = ""

  try {
    await insertPublicExportForReadySmoke(supabase, payload.kitId, publicUrl)
    await postBuffer(baseUrl, "/api/render", {
      markdown: readyMarkdown,
      branch: "brand",
      designPreset: "brand",
      outputMode: "all-in-one",
      target: "complete",
      kitId: payload.kitId,
    })

    const firstResponse = await fetchWithTimeout(new URL(`/api/kits/${payload.kitId}/ready`, baseUrl), {
      method: "POST",
    }, 60_000)
    const firstReady = await firstResponse.json()

    assert(firstResponse.ok, `Ready-to-sell public export returned ${firstResponse.status}: ${firstReady.error || ""}`)
    assert(firstReady.exportUrl === publicUrl, "Ready-to-sell did not choose the latest public export URL.")
    assert(firstReady.productId, "Ready-to-sell did not create a Product row.")
    assert(firstReady.productStatus === "live", `Product status should be live, got ${firstReady.productStatus}.`)
    productId = firstReady.productId

    const secondResponse = await fetchWithTimeout(new URL(`/api/kits/${payload.kitId}/ready`, baseUrl), {
      method: "POST",
    }, 60_000)
    const secondReady = await secondResponse.json()

    assert(secondResponse.ok, `Ready-to-sell reuse returned ${secondResponse.status}: ${secondReady.error || ""}`)
    assert(secondReady.productId === productId, "Ready-to-sell created a duplicate Product instead of reusing the first one.")
    assert(secondReady.reusedProduct === true, "Ready-to-sell did not report that it reused the existing Product.")

    const savedKit = await getJson(baseUrl, `/api/kits/${payload.kitId}`)

    assert(savedKit.productId === productId, "Saved kit did not keep the linked Product id.")
    assert(savedKit.productStatus === "live", `Saved kit product status should be live, got ${savedKit.productStatus}.`)
  } finally {
    await cleanupReadySmokeRows(supabase, {
      kitId: payload.kitId,
      productId,
      productName: title,
    })
  }
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
    outputMode: "all-in-one",
    target: "complete",
    kitId: brandPayload.kitId,
  })
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
    "pdf:complete",
    "pdf:guide",
    "pdf:workbook",
    "fillable:workbook",
    "mockup",
    "zip:brand-package",
  ], "Brand saved kit")
  const savedKit = {
    brandKitId: brandPayload.kitId,
    brandKitName,
    mathKitId: "",
    mathKitName: "",
  }

  const mathKitName = `Meet at the Heal Lesson Book Smoke ${timestamp}`
  const lessonBookMarkdown = meetAtTheHealPackage.lessonBookMarkdown.replace(
    /^title:.*$/m,
    `title: ${mathKitName}`
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

  savedKit.mathKitId = mathPayload.kitId
  savedKit.mathKitName = mathKitName

  return savedKit
}

async function testDashboardExportHistoryPanel(baseUrl, savedKit) {
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await disableClipboardForCopyFallback(page)
    await page.goto(baseUrl, { waitUntil: "networkidle" })

    await page.getByTestId("sidebar-all-kits").click()
    await page.getByTestId("all-kits-search").fill(savedKit.brandKitName)

    const savedKitButton = page.getByTestId(`all-kits-open-${savedKit.brandKitId}`)
    await expectVisible(savedKitButton, "Saved kit with exports")
    await expectVisible(page.getByText(/Showing \d+ of \d+ saved kit/i), "filtered saved kit count")

    await page.getByTestId("all-kits-search").fill(`no saved kit ${Date.now()}`)
    await expectVisible(page.getByText("No saved kits match that search."), "saved kit empty search result")

    await page.getByTestId("all-kits-search").fill(savedKit.brandKitName)
    await expectVisible(savedKitButton, "Saved kit after clearing no-match search")
    await savedKitButton.click()

    await expectVisible(page.getByText("Saved kit opened."), "saved kit opened message")
    await expectVisible(page.getByText("6 saved files"), "saved export count")
    await expectVisible(page.getByText("pdf / complete", { exact: true }), "complete PDF export type")
    await expectVisible(page.getByText("pdf / guide", { exact: true }), "lesson guide export type")
    await expectVisible(page.getByText("pdf / workbook", { exact: true }), "workbook export type")
    await expectVisible(page.getByText("fillable / workbook", { exact: true }), "fillable export type")
    await expectVisible(page.getByText("mockup", { exact: true }), "mockup export type")
    await expectVisible(page.getByText("zip / brand package", { exact: true }), "Brand ZIP export type")
    await expectExportHistoryRow(page, "pdf:complete", /\.pdf$/i, "complete PDF export row")
    await expectExportHistoryRow(page, "pdf:guide", /\.pdf$/i, "lesson guide export row")
    await expectExportHistoryRow(page, "pdf:workbook", /\.pdf$/i, "workbook PDF export row")
    await expectExportHistoryRow(page, "fillable:workbook", /\.pdf$/i, "fillable workbook export row")
    await expectExportHistoryRow(page, "mockup", /\.png$/i, "mockup export row")
    await expectExportHistoryRow(page, "zip:brand-package", /\.zip$/i, "Brand ZIP export row")

    await page.getByRole("button", { name: /Copy Latest/i }).click()
    await expectVisible(
      page.getByText(/Local fallback copied|Latest export link copied|Links are ready below/i),
      "Copy Latest feedback"
    )
    await expectCopyReadyTextIncludes(page, ["kit-factory-download://"], "Copy Latest fallback text")

    await page.getByRole("button", { name: /Copy All/i }).click()
    await expectVisible(
      page.getByText(/Export list copied|All export links copied|Links are ready below/i),
      "Copy All feedback"
    )
    await expectCopyReadyTextIncludes(
      page,
      [
        "pdf:complete",
        "pdf:guide",
        "pdf:workbook",
        "fillable:workbook",
        "mockup",
        "zip:brand-package",
        "kit-factory-download://",
      ],
      "Copy All export list"
    )

    await expectVisible(
      page.getByText(/No public export link yet\. Current saved exports are local fallbacks/i),
      "ready-to-sell local fallback warning"
    )
    await expectDisabled(page.getByRole("button", { name: /Mark Ready/i }), "Mark Ready action without public export")

    if (savedKit.mathKitId) {
      await page.getByTestId("sidebar-all-kits").click()
      await page.getByTestId("all-kits-search").fill(savedKit.mathKitName)

      const mathKitButton = page.getByTestId(`all-kits-open-${savedKit.mathKitId}`)
      await expectVisible(mathKitButton, "Saved Meet at the Heal kit with package export")
      await mathKitButton.click()

      await expectVisible(page.getByText("Saved kit opened."), "Meet at the Heal saved kit opened message")
      await expectVisible(page.getByText("1 saved file"), "Meet at the Heal saved export count")
      await expectVisible(
        page.getByText("zip / meetatheal package", { exact: true }),
        "Meet at the Heal ZIP export type"
      )
      await expectExportHistoryRow(
        page,
        "zip:meetatheal-package",
        /meet-at-the-heal-kit-package\.zip$/i,
        "Meet at the Heal ZIP export row"
      )
    }

    await page.getByTestId("sidebar-new-kit").click()
    await expectVisible(page.getByText("New kit started."), "New Kit reset message")
    await expectVisible(page.getByText("No saved files yet"), "New Kit cleared export history")
    await expectVisible(
      page.getByText("No linked Product yet. Generate a public export, then mark the kit ready."),
      "New Kit cleared ready-to-sell product state"
    )
    await expectDisabled(page.getByRole("button", { name: /Mark Ready/i }), "New Kit ready action")

    const newKitMarkdown = await page.getByLabel("Markdown source").inputValue()
    assert(newKitMarkdown.includes("title: Untitled Kit"), "New Kit did not reset the markdown title after opening a saved kit.")
    assert(newKitMarkdown.includes("design_preset: brand"), "New Kit did not reset the design preset after opening a saved kit.")
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

  await assertUsLetterPdf(complete, "Complete PDF")
  await assertUsLetterPdf(guide, "Lesson guide PDF")
  await assertUsLetterPdf(workbook, "Workbook PDF")
  assert((await pageCount(complete)) === 20, "Complete PDF should include every page in the proof kit.")
  assert((await pageCount(guide)) === 15, "Lesson guide should include cover, guide pages, closing, and back cover.")
  assert((await pageCount(workbook)) === 9, "Workbook PDF should include cover, intro, workbook pages, closing, and back cover.")
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
  assertUsLetterPages(pdf, "Fillable workbook PDF")
  const fields = pdf.getForm().getFields()
  const fieldCount = fields.length
  const firstCheckbox = fields.find((field) => field.getName().includes("check_01"))
  const firstCheckboxRect = firstCheckbox?.acroField?.getWidgets?.()[0]?.getRectangle?.()

  assert(fieldCount >= 30, `Expected fillable workbook fields, got ${fieldCount}.`)
  assert(firstCheckboxRect, "Expected a fillable checklist checkbox field.")
  assert(
    firstCheckboxRect.x > 170 && firstCheckboxRect.x < 205,
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
  const entries = extractStoredZipEntries(zip)
  const expectedFilenameSuffixes = ["brand-complete.pdf", "brand-land-complete.pdf"]

  assert(zip.length > 100_000, "Brand package ZIP is unexpectedly small.")
  assert(entries.size === 2, `Brand package ZIP should contain 2 files, got ${entries.size}.`)

  for (const filenameSuffix of expectedFilenameSuffixes) {
    const [filename, data] = findZipEntryBySuffix(entries, filenameSuffix)

    assert(filename, `Brand package ZIP is missing ${filenameSuffix}.`)
    await assertUsLetterPdf(data, `Brand package file ${filename}`)
    assert((await pageCount(data)) === 20, `${filename} should be a complete 20-page PDF.`)
  }
}

async function testMeetAtTheHealPackage(baseUrl, meetAtTheHealPackage) {
  const zip = await postBuffer(baseUrl, "/api/package/meetatheal", {
    lessonBookMarkdown: meetAtTheHealPackage.lessonBookMarkdown,
    couplesWorkbookMarkdown: meetAtTheHealPackage.couplesWorkbookMarkdown,
    riseWorkbookMarkdown: meetAtTheHealPackage.riseWorkbookMarkdown,
    landWorkbookMarkdown: meetAtTheHealPackage.landWorkbookMarkdown,
  })
  const entries = extractStoredZipEntries(zip)
  const filenames = [
    "meet-at-the-heal-lesson-book.pdf",
    "meet-at-the-heal-couples-workbook.pdf",
    "meet-at-the-heal-rise-individual-workbook.pdf",
    "meet-at-the-heal-land-individual-workbook.pdf",
  ]

  assert(zip.length > 100_000, "Meet at the Heal package ZIP is unexpectedly small.")
  assert(entries.size === 4, `Meet at the Heal package ZIP should contain 4 files, got ${entries.size}.`)

  for (const filename of filenames) {
    const data = entries.get(filename)

    assert(data, `Package ZIP is missing ${filename}.`)
    await assertUsLetterPdf(data, `Meet at the Heal package file ${filename}`)
    assert((await pageCount(data)) === 6, `${filename} should be a 6-page sample PDF.`)
  }
}

async function testMeetAtTheHealPackageValidation(baseUrl, meetAtTheHealPackage) {
  const response = await fetchWithTimeout(new URL("/api/package/meetatheal", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lessonBookMarkdown: meetAtTheHealPackage.lessonBookMarkdown,
      couplesWorkbookMarkdown: meetAtTheHealPackage.couplesWorkbookMarkdown,
      riseWorkbookMarkdown: "",
      landWorkbookMarkdown: meetAtTheHealPackage.landWorkbookMarkdown,
    }),
  }, 120_000)
  const payload = await response.json()
  const issueText = JSON.stringify(payload)

  assert(response.status === 400, `Missing package markdown should return 400, got ${response.status}.`)
  assert(issueText.includes("Rise Individual Workbook markdown is required."), "Missing Rise workbook message was not returned.")
  assert(issueText.includes("Paste or upload the markdown"), "Missing package markdown detail was not returned.")
}

function smokeSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""

  if (!url || !key) {
    return null
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
    },
  })
}

async function insertPublicExportForReadySmoke(supabase, kitId, publicUrl) {
  const timestamp = new Date().toISOString()
  const job = await insertSmokeRow(
    supabase,
    "export_jobs",
    {
      completed_at: timestamp,
      export_type: "pdf",
      kit_id: kitId,
      started_at: timestamp,
      status: "completed",
      target: "complete",
      type: "pdf",
    },
    "id"
  )

  assert(job?.id, "Could not create the public export job for ready-to-sell smoke test.")

  await insertSmokeRow(
    supabase,
    "export_files",
    {
      export_job_id: job.id,
      file_type: "pdf:complete",
      file_url: publicUrl,
    },
    "id"
  )
}

async function cleanupReadySmokeRows(supabase, { kitId, productId, productName }) {
  if (productId) {
    await supabase.from("products").delete().eq("id", productId)
  }

  if (productName) {
    await supabase
      .from("products")
      .delete()
      .eq("name", productName)
      .eq("created_from", "kit_factory")
  }

  if (!kitId) {
    return
  }

  const { data: jobs } = await supabase.from("export_jobs").select("id").eq("kit_id", kitId)
  const jobIds = (jobs ?? []).map((job) => String(job.id)).filter(Boolean)

  if (jobIds.length > 0) {
    await supabase.from("export_files").delete().in("export_job_id", jobIds)
    await supabase.from("export_jobs").delete().in("id", jobIds)
  }

  await supabase.from("assets").delete().eq("kit_id", kitId)
  await supabase.from("kit_pages").delete().eq("kit_id", kitId)
  await supabase.from("kit_documents").delete().eq("kit_id", kitId)
  await supabase.from("kit_versions").delete().eq("kit_id", kitId)
  await supabase.from("kits").delete().eq("id", kitId)
}

async function insertSmokeRow(supabase, table, row, select = "*") {
  let currentRow = pruneEmptyValues(row)

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabase.from(table).insert(currentRow).select(select).single()

    if (!error) {
      return data
    }

    const missingColumn = missingColumnFromSupabaseError(error)

    if (!missingColumn || !Object.hasOwn(currentRow, missingColumn)) {
      throw error
    }

    currentRow = withoutKey(currentRow, missingColumn)
  }

  throw new Error(`Could not insert smoke row into ${table}.`)
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

async function assertUsLetterPdf(pdfBuffer, label) {
  assertPdfHeader(pdfBuffer, label)
  const pdf = await PDFDocument.load(pdfBuffer)

  assertUsLetterPages(pdf, label)
}

function assertPdfHeader(pdfBuffer, label) {
  assert(
    pdfBuffer[0] === 0x25 && pdfBuffer[1] === 0x50 && pdfBuffer[2] === 0x44 && pdfBuffer[3] === 0x46,
    `${label} is not a PDF file.`
  )
}

function assertUsLetterPages(pdf, label) {
  const pages = pdf.getPages()

  assert(pages.length > 0, `${label} has no pages.`)

  for (const [index, page] of pages.entries()) {
    const { width, height } = page.getSize()

    assert(
      approximately(width, 612) && approximately(height, 792),
      `${label} page ${index + 1} should be US Letter, got ${width}x${height}.`
    )
  }
}

function approximately(value, expected, tolerance = 2) {
  return Math.abs(value - expected) <= tolerance
}

function extractStoredZipEntries(zipBuffer) {
  const entries = new Map()
  let offset = 0

  while (offset + 30 <= zipBuffer.length && zipBuffer.readUInt32LE(offset) === 0x04034b50) {
    const compressionMethod = zipBuffer.readUInt16LE(offset + 8)
    const compressedSize = zipBuffer.readUInt32LE(offset + 18)
    const filenameLength = zipBuffer.readUInt16LE(offset + 26)
    const extraLength = zipBuffer.readUInt16LE(offset + 28)
    const filenameStart = offset + 30
    const filenameEnd = filenameStart + filenameLength
    const dataStart = filenameEnd + extraLength
    const dataEnd = dataStart + compressedSize
    const filename = zipBuffer.subarray(filenameStart, filenameEnd).toString("utf8")

    assert(compressionMethod === 0, `${filename} should be stored without compression.`)
    assert(dataEnd <= zipBuffer.length, `${filename} extends past the end of the ZIP file.`)

    entries.set(filename, zipBuffer.subarray(dataStart, dataEnd))
    offset = dataEnd
  }

  assert(entries.size > 0, "ZIP file did not contain any local file entries.")

  return entries
}

function findZipEntryBySuffix(entries, filenameSuffix) {
  return (
    Array.from(entries.entries()).find(([filename]) => filename.endsWith(filenameSuffix)) ?? ["", null]
  )
}

async function expectVisible(locator, label) {
  await waitFor(async () => locator.isVisible(), `${label} was not visible.`)
}

async function expectDisabled(locator, label) {
  await waitFor(async () => locator.isDisabled(), `${label} was not disabled.`)
}

async function expectExportHistoryRow(page, fileType, filenamePattern, label) {
  const row = page.getByTestId(`export-history-row-${fileType}`)

  await expectVisible(row, label)
  await expectVisible(
    page.getByTestId(`export-history-filename-${fileType}`).filter({ hasText: filenamePattern }),
    `${label} filename`
  )
  await expectVisible(
    page.getByTestId(`export-history-status-${fileType}`).filter({ hasText: /^completed$/i }),
    `${label} status`
  )
  await waitFor(async () => {
    const dateText = await page.getByTestId(`export-history-date-${fileType}`).innerText()

    return Boolean(dateText.trim()) && dateText.trim() !== "No date"
  }, `${label} date was missing.`)
}

async function expectCopyReadyTextIncludes(page, expectedParts, label) {
  const textarea = page.getByLabel("Copy-ready text")

  await expectVisible(textarea, label)
  await waitFor(async () => {
    const value = await textarea.inputValue()

    return expectedParts.every((part) => value.includes(part))
  }, `${label} did not include expected export text.`)
}

async function disableClipboardForCopyFallback(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Clipboard disabled for smoke test.")
        },
      },
    })
    document.execCommand = () => false
  })
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

CHECK: Confirm every export link opens.
CHECK: Save the ready package.

<!-- PAGE: back-cover -->

TITLE: Best Collective
SUBTITLE: One System. Five Rooms. All For You.
TAGLINE: Export history is ready.
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

function missingColumnFromSupabaseError(error) {
  const combined = [error.message, error.details, error.hint].filter(Boolean).join(" ")
  const patterns = [
    /find the ['"]([^'"]+)['"] column/i,
    /column ['"]?([^'"\s]+)['"]?/i,
  ]

  for (const pattern of patterns) {
    const match = combined.match(pattern)

    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

function pruneEmptyValues(row) {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined && value !== null)
  )
}

function withoutKey(row, key) {
  return Object.fromEntries(Object.entries(row).filter(([entryKey]) => entryKey !== key))
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
