import "server-only"

import { chromium, type Page } from "playwright"

import { buildKitHtml } from "@/lib/renderer/htmlBuilder"
import { type ContentBlock, type KitPage, type ParsedKit } from "@/lib/parser/pageTypes"
import { type FieldSpec } from "@/lib/fillable/types"

export type RenderTarget = "guide" | "workbook" | "complete"

export function selectPagesForTarget(kit: ParsedKit, target: RenderTarget): ParsedKit {
  if (target === "complete") {
    return kit
  }

  const pages = kit.pages.filter((page) => {
    if (page.type === "cover" || page.type === "closing" || page.type === "back-cover") {
      return true
    }

    if (target === "workbook") {
      return page.fillable
    }

    return !page.fillable
  })

  if (target === "workbook") {
    const coverIndex = pages.findIndex((page) => page.type === "cover")
    const introPage = createWorkbookIntroPage(kit)

    if (coverIndex >= 0) {
      pages.splice(coverIndex + 1, 0, introPage)
    } else {
      pages.unshift(introPage)
    }
  }

  return {
    ...kit,
    pages: expandBrandWorkbookPages(pages, kit),
  }
}

export async function renderKitPdf(kit: ParsedKit, target: RenderTarget) {
  const renderKit = selectPagesForTarget(kit, target)
  const html = buildKitHtml(renderKit, target)

  return renderHtmlToPdf(html)
}

export async function renderKitPdfWithFillableFields(kit: ParsedKit, target: RenderTarget) {
  const renderKit = selectPagesForTarget(kit, target)
  const html = buildKitHtml(renderKit, target)
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await createRenderPage(browser)

    await page.setContent(html, { waitUntil: "networkidle" })

    const fields = await measureFillableFields(page, renderKit.slug)
    const pdf = Buffer.from(
      await page.pdf({
        format: "Letter",
        printBackground: true,
        preferCSSPageSize: true,
      })
    )

    return { pdf, fields }
  } finally {
    await browser.close()
  }
}

async function renderHtmlToPdf(html: string) {
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await createRenderPage(browser)

    await page.setContent(html, { waitUntil: "networkidle" })

    return Buffer.from(
      await page.pdf({
        format: "Letter",
        printBackground: true,
        preferCSSPageSize: true,
      })
    )
  } finally {
    await browser.close()
  }
}

function createRenderPage(browser: Awaited<ReturnType<typeof chromium.launch>>) {
  return browser.newPage({
    viewport: {
      width: 816,
      height: 1056,
    },
  })
}

async function measureFillableFields(page: Page, slug: string): Promise<FieldSpec[]> {
  const markers = await page.$$eval("[data-fillable-kind]", (elements) => {
    const pageHeight = 792
    const pointsPerCssPixel = 72 / 96
    const pages = Array.from(document.querySelectorAll<HTMLElement>(".page"))

    return elements.flatMap((element) => {
      const htmlElement = element as HTMLElement
      const pageElement = htmlElement.closest<HTMLElement>(".page")

      if (!pageElement) {
        return []
      }

      const pageIndex = pages.indexOf(pageElement)
      const suffix = htmlElement.dataset.fillableSuffix
      const kind = htmlElement.dataset.fillableKind

      if (pageIndex < 0 || !suffix || (kind !== "text" && kind !== "checkbox")) {
        return []
      }

      const rect = htmlElement.getBoundingClientRect()
      const pageRect = pageElement.getBoundingClientRect()

      if (rect.width <= 0 || rect.height <= 0) {
        return []
      }

      const xInset = Number(htmlElement.dataset.fillableInsetX || 0)
      const yInset = Number(htmlElement.dataset.fillableInsetY || 0)
      const x = (rect.left - pageRect.left + xInset) * pointsPerCssPixel
      const top = (rect.top - pageRect.top + yInset) * pointsPerCssPixel
      const width = Math.max(6, (rect.width - xInset * 2) * pointsPerCssPixel)
      const height = Math.max(6, (rect.height - yInset * 2) * pointsPerCssPixel)
      const fontSize = Number(htmlElement.dataset.fillableFontSize || 0) || undefined
      const multiline = htmlElement.dataset.fillableMultiline !== "false"
      const textColor =
        htmlElement.dataset.fillableTextColor === "white" || htmlElement.dataset.fillableTextColor === "plum"
          ? htmlElement.dataset.fillableTextColor
          : undefined

      return [
        {
          pageIndex,
          suffix,
          kind,
          x,
          y: pageHeight - top - height,
          width,
          height,
          multiline,
          fontSize,
          textColor,
        },
      ]
    })
  })

  return markers.map((marker): FieldSpec => ({
    pageIndex: marker.pageIndex,
    name: fieldName(slug, marker.pageIndex, marker.suffix),
    kind: marker.kind as "text" | "checkbox",
    x: marker.x,
    y: marker.y,
    width: marker.width,
    height: marker.height,
    multiline: marker.multiline,
    fontSize: marker.fontSize,
    textColor: marker.textColor as "plum" | "white" | undefined,
  }))
}

function fieldName(slug: string, pageIndex: number, suffix: string) {
  const pageNum = String(pageIndex + 1).padStart(3, "0")

  return `${slug}_${pageNum}_${suffix}`
}

function createWorkbookIntroPage(kit: ParsedKit): KitPage {
  const content: ContentBlock[] = [
    {
      type: "paragraph",
      text:
        "Use this workbook alongside the matching lesson guide when one is included. Complete each page after the matching chapter or section so your notes stay connected to the lesson.",
    },
    {
      type: "check-list",
      items: [
        "Read the matching lesson first.",
        "Complete the reflection or action page that belongs with that chapter.",
        "Return to your tracker after each section so progress stays visible.",
      ],
    },
  ]

  return {
    id: "workbook-intro",
    type: "how-to-use",
    rawType: "how-to-use",
    section: "Workbook",
    title: "How To Use This Workbook",
    subtitle: kit.title ? `For ${kit.title}` : "",
    tagline: "",
    content,
    prompts: [],
    checks: [],
    noteLabel: "",
    tableHeaders: [],
    tableRows: [],
    actions: [],
    questions: [],
    storyLabel: "",
    story: "",
    takeaway: "",
    imageSlot: "",
    icon: "",
    reflects: [],
    bottomNote: "",
    fillable: false,
    raw: "",
    unsupportedFields: [],
    parserErrors: [],
    parserWarnings: [],
  }
}

function expandBrandWorkbookPages(pages: KitPage[], kit: ParsedKit) {
  if (kit.designPreset !== "brand" && kit.designPreset !== "brand-land") {
    return pages
  }

  return pages.flatMap((page) => {
    if (page.type === "tracker") {
      return expandTrackerPage(page)
    }

    if (page.type === "action-plan") {
      return expandActionPlanPage(page)
    }

    return [page]
  })
}

function expandTrackerPage(page: KitPage) {
    const rows = page.tableRows.length > 0 ? page.tableRows : ["Revenue", "Expenses", "Profit", "Notes"]

    if (rows.length <= 6) {
      return [page]
    }

    const chunks = chunkRows(rows, 6)

    return chunks.map((chunk, index) => ({
      ...page,
      id: `${page.id}-part-${index + 1}`,
      title: chunks.length > 1 ? `${page.title || "Tracker"} ${index + 1}` : page.title,
      subtitle:
        index === 0
          ? page.subtitle
          : page.subtitle
            ? `${page.subtitle} Continued.`
            : "Continued.",
      tableRows: chunk,
      noteLabel: index === chunks.length - 1 ? page.noteLabel : "",
    }))
}

function expandActionPlanPage(page: KitPage) {
  const items = [...(page.actions.length > 0 ? page.actions : ["What is the next action?"]), ...page.questions]

  if (items.length <= 4) {
    return [page]
  }

  const chunks = chunkRows(items, 3)

  return chunks.map((chunk, index) => ({
    ...page,
    id: `${page.id}-part-${index + 1}`,
    title: chunks.length > 1 ? `${page.title || "Action Plan"} ${index + 1}` : page.title,
    subtitle:
      index === 0
        ? page.subtitle
        : page.subtitle
          ? `${page.subtitle} Continued.`
          : "Continued.",
    actions: chunk,
    questions: [],
  }))
}

function chunkRows(rows: string[], size: number) {
  const chunks: string[][] = []

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size))
  }

  return chunks
}
