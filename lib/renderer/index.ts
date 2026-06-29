import "server-only"

import { chromium } from "playwright"

import { buildKitHtml } from "@/lib/renderer/htmlBuilder"
import { type ParsedKit } from "@/lib/parser/pageTypes"

export type RenderTarget = "guide" | "workbook" | "complete"

export function selectPagesForTarget(kit: ParsedKit, target: RenderTarget): ParsedKit {
  if (target === "complete") {
    return kit
  }

  const pages = kit.pages.filter((page) => {
    if (target === "workbook") {
      return page.fillable
    }

    return !page.fillable
  })

  return {
    ...kit,
    pages,
  }
}

export async function renderKitPdf(kit: ParsedKit, target: RenderTarget) {
  const renderKit = selectPagesForTarget(kit, target)
  const html = buildKitHtml(renderKit)
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({
      viewport: {
        width: 816,
        height: 1056,
      },
    })

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
