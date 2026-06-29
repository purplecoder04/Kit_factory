import "server-only"

import fs from "node:fs"
import path from "node:path"

import { chromium } from "playwright"

import { type KitPage, type ParsedKit } from "@/lib/parser/pageTypes"
import { getBranchTokens } from "@/tokens"

const mockupWidth = 1200
const mockupHeight = 900
const fontFaces = buildFontFaces()

export async function renderKitMockupPng(kit: ParsedKit) {
  const html = buildMockupHtml(kit)
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({
      viewport: {
        width: mockupWidth,
        height: mockupHeight,
      },
      deviceScaleFactor: 1,
    })

    await page.setContent(html, { waitUntil: "networkidle" })

    return Buffer.from(
      await page.screenshot({
        type: "png",
        fullPage: false,
      })
    )
  } finally {
    await browser.close()
  }
}

function buildMockupHtml(kit: ParsedKit) {
  const tokens = getBranchTokens(kit.branch)
  const workbookPage = kit.pages.find((page) => page.type === "workbook")
  const checklistPage = kit.pages.find((page) => page.type === "checklist")
  const reflectionPage = kit.pages.find((page) => page.type === "reflection")
  const branchLabel = tokens.shortName.toUpperCase()

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(kit.title)} Mockup</title>
    <style>
      ${fontFaces}
      * { box-sizing: border-box; }
      html, body { margin: 0; width: ${mockupWidth}px; height: ${mockupHeight}px; }
      body {
        background: ${tokens.background};
        color: ${tokens.ink};
        font-family: "Poppins", Arial, sans-serif;
      }
      .stage {
        position: relative;
        width: ${mockupWidth}px;
        height: ${mockupHeight}px;
        overflow: hidden;
        padding: 64px 70px;
      }
      .paper-glow {
        position: absolute;
        inset: 36px;
        border: 1px solid rgba(255,255,255,0.12);
        pointer-events: none;
      }
      .hero-copy {
        position: absolute;
        left: 672px;
        top: 102px;
        width: 408px;
      }
      .eyebrow {
        color: ${tokens.gold};
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.32em;
        text-transform: uppercase;
      }
      h1 {
        color: ${tokens.paper};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 66px;
        line-height: 0.92;
        margin: 20px 0 0;
      }
      .subline {
        color: rgba(255, 250, 243, 0.76);
        font-size: 18px;
        line-height: 1.55;
        margin-top: 26px;
      }
      .badge-row {
        display: flex;
        gap: 12px;
        margin-top: 30px;
      }
      .badge {
        border: 1px solid rgba(255,255,255,0.18);
        color: ${tokens.paper};
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.18em;
        padding: 10px 13px;
        text-transform: uppercase;
      }
      .stack {
        position: absolute;
        left: 108px;
        top: 92px;
        width: 478px;
        height: 616px;
      }
      .sheet {
        position: absolute;
        width: 388px;
        height: 502px;
        background: ${tokens.paper};
        border: 1px solid ${tokens.line};
        box-shadow: 0 28px 55px rgba(0,0,0,0.28);
      }
      .sheet.back {
        left: 58px;
        top: 66px;
        transform: rotate(8deg);
      }
      .sheet.mid {
        left: 28px;
        top: 36px;
        transform: rotate(-5deg);
      }
      .sheet.front {
        left: 0;
        top: 0;
      }
      .ribbon {
        height: 34px;
        background: ${tokens.plum};
        color: ${tokens.paper};
        display: flex;
        align-items: center;
        padding: 0 22px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.28em;
        text-transform: uppercase;
      }
      .cover-panel {
        position: absolute;
        left: 42px;
        right: 42px;
        top: 92px;
        min-height: 188px;
        display: grid;
        place-items: center;
        background: ${tokens.plum};
        color: ${tokens.paper};
        overflow: hidden;
        padding: 30px;
        text-align: center;
      }
      .cover-panel::before {
        content: "";
        position: absolute;
        width: 220px;
        height: 78px;
        top: 28px;
        left: 66px;
        border: 28px solid rgba(255,255,255,0.08);
        border-radius: 50%;
        transform: rotate(-6deg);
      }
      .cover-kicker {
        color: ${tokens.gold};
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.38em;
        margin-bottom: 12px;
        position: relative;
        text-transform: uppercase;
      }
      .cover-title {
        color: ${tokens.paper};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 34px;
        font-weight: 700;
        line-height: 0.98;
        margin: 0 auto;
        max-width: 270px;
        position: relative;
      }
      .cover-line {
        background: ${tokens.gold};
        height: 1px;
        margin: 14px auto;
        width: 64px;
      }
      .cover-foot {
        position: absolute;
        bottom: 22px;
        left: 42px;
        right: 42px;
        border-top: 1px solid ${tokens.line};
        color: ${tokens.mutedInk};
        display: flex;
        justify-content: space-between;
        font-size: 9px;
        padding-top: 12px;
      }
      .thumb-row {
        position: absolute;
        bottom: 60px;
        left: 92px;
        right: 92px;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
      }
      .thumb {
        min-height: 132px;
        background: ${tokens.paper};
        border: 1px solid ${tokens.line};
        box-shadow: 0 18px 36px rgba(0,0,0,0.2);
        padding: 18px;
      }
      .thumb-label {
        color: ${tokens.gold};
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.24em;
        margin-bottom: 8px;
        text-transform: uppercase;
      }
      .thumb-title {
        color: ${tokens.ink};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 23px;
        font-weight: 700;
        line-height: 1;
      }
      .prompt {
        border-left: 4px solid ${tokens.gold};
        border-radius: 7px;
        border: 1px solid ${tokens.line};
        margin-top: 14px;
        padding: 10px 12px;
      }
      .prompt-text {
        color: ${tokens.ink};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 15px;
        font-style: italic;
        font-weight: 600;
        line-height: 1.1;
      }
      .lines {
        display: grid;
        gap: 8px;
        margin-top: 10px;
      }
      .lines span {
        background: ${tokens.line};
        display: block;
        height: 1px;
      }
      .check {
        align-items: center;
        border-bottom: 1px solid ${tokens.line};
        display: grid;
        gap: 8px;
        grid-template-columns: 12px 1fr;
        padding: 8px 0;
      }
      .box {
        border: 1px solid ${tokens.line};
        height: 12px;
        width: 12px;
      }
      .reflection {
        background: ${tokens.plum};
        border-radius: 8px;
        color: ${tokens.paper};
        margin-top: 14px;
        padding: 16px;
      }
      .reflection .lines span {
        background: rgba(255,255,255,0.42);
      }
      .reflection .prompt-text {
        color: ${tokens.paper};
      }
    </style>
  </head>
  <body>
    <main class="stage">
      <div class="paper-glow"></div>
      <section class="stack">
        <div class="sheet back"><div class="ribbon">Workbook</div></div>
        <div class="sheet mid"><div class="ribbon">Lesson</div></div>
        <div class="sheet front">
          <div class="ribbon">${escapeHtml(branchLabel)}</div>
          <div class="cover-panel">
            <div>
              <div class="cover-kicker">${escapeHtml(tokens.shortName)}</div>
              <h2 class="cover-title">${escapeHtml(kit.title)}</h2>
              <div class="cover-line"></div>
            </div>
          </div>
          <div class="cover-foot"><span>${escapeHtml(tokens.footer)}</span><span>01</span></div>
        </div>
      </section>
      <section class="hero-copy">
        <div class="eyebrow">${escapeHtml(tokens.shortName)} Kit</div>
        <h1>${escapeHtml(kit.title)}</h1>
        <p class="subline">Printable and fillable workbook pages for a clear, polished learning experience.</p>
        <div class="badge-row">
          <span class="badge">PDF</span>
          <span class="badge">Fillable</span>
          <span class="badge">Workbook</span>
        </div>
      </section>
      <section class="thumb-row">
        ${renderWorkbookThumb(workbookPage)}
        ${renderChecklistThumb(checklistPage)}
        ${renderReflectionThumb(reflectionPage)}
      </section>
    </main>
  </body>
</html>`
}

function renderWorkbookThumb(page?: KitPage) {
  const prompt = page?.prompts[0] ?? "The first thing I want to make clear is:"

  return `<article class="thumb">
    <div class="thumb-label">Workbook</div>
    <div class="thumb-title">${escapeHtml(page?.title || "Workbook Pages")}</div>
    <div class="prompt">
      <div class="prompt-text">${escapeHtml(prompt)}</div>
      <div class="lines"><span></span><span></span><span></span></div>
    </div>
  </article>`
}

function renderChecklistThumb(page?: KitPage) {
  const items = page?.prompts.slice(0, 3) ?? []
  const safeItems = items.length > 0 ? items : ["Choose the next step.", "Make the setup simple.", "Check the final file."]

  return `<article class="thumb">
    <div class="thumb-label">Checklist</div>
    <div class="thumb-title">${escapeHtml(page?.title || "Action Checklist")}</div>
    ${safeItems.map((item) => `<div class="check"><span class="box"></span><span>${escapeHtml(item)}</span></div>`).join("")}
  </article>`
}

function renderReflectionThumb(page?: KitPage) {
  const prompt = page?.prompts[0] ?? "One thing I learned is:"

  return `<article class="thumb">
    <div class="thumb-label">Reflection</div>
    <div class="thumb-title">${escapeHtml(page?.title || "Reflection Page")}</div>
    <div class="reflection">
      <div class="prompt-text">${escapeHtml(prompt)}</div>
      <div class="lines"><span></span><span></span><span></span></div>
    </div>
  </article>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function buildFontFaces() {
  const fonts = [
    ["Poppins", "400", "normal", "poppins/files/poppins-latin-400-normal.woff2"],
    ["Poppins", "600", "normal", "poppins/files/poppins-latin-600-normal.woff2"],
    [
      "Cormorant Garamond",
      "600",
      "italic",
      "cormorant-garamond/files/cormorant-garamond-latin-600-italic.woff2",
    ],
    [
      "Cormorant Garamond",
      "700",
      "normal",
      "cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff2",
    ],
  ] as const

  return fonts
    .map(([family, weight, style, file]) => {
      const filePath = path.join(process.cwd(), "node_modules", "@fontsource", file)
      const data = fs.readFileSync(filePath).toString("base64")

      return `@font-face { font-family: "${family}"; font-weight: ${weight}; font-style: ${style}; font-display: swap; src: url(data:font/woff2;base64,${data}) format("woff2"); }`
    })
    .join("\n")
}
