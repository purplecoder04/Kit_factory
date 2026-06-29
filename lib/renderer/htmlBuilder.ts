import "server-only"

import fs from "node:fs"
import path from "node:path"

import { type ContentBlock, type KitPage, type ParsedKit } from "@/lib/parser/pageTypes"
import { getBranchTokens } from "@/tokens"

const fontFaces = buildFontFaces()

export function buildKitHtml(kit: ParsedKit) {
  const tokens = getBranchTokens()
  const pages = kit.pages.map((page, index) => renderPage(page, index, kit.pages.length, kit.title))

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(kit.title)}</title>
    <style>
      ${fontFaces}
      @page { size: Letter; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: ${tokens.background}; color: ${tokens.ink}; }
      body { font-family: "Poppins", Arial, sans-serif; }
      .page {
        position: relative;
        width: 8.5in;
        height: 11in;
        overflow: hidden;
        page-break-after: always;
        background: ${tokens.paper};
        padding: 0.66in 0.72in 0.66in;
      }
      .page:last-child { page-break-after: auto; }
      .section-label {
        color: ${tokens.accent};
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 600;
        margin-bottom: 14px;
      }
      h1, h2 {
        font-family: "Lora", Georgia, serif;
        font-weight: 700;
        color: ${tokens.ink};
        margin: 0;
      }
      h1 { font-size: 58px; line-height: 0.98; max-width: 5.6in; }
      h2 { font-size: 34px; line-height: 1.1; max-width: 6.2in; }
      p { color: ${tokens.mutedInk}; font-size: 13px; line-height: 1.72; margin: 0 0 14px; }
      ul { margin: 14px 0 0 18px; padding: 0; color: ${tokens.mutedInk}; font-size: 13px; line-height: 1.6; }
      li { margin-bottom: 8px; }
      .brand-mark { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: ${tokens.mutedInk}; font-weight: 600; }
      .cover-title { position: absolute; left: 0.72in; top: 2.25in; }
      .cover-title h1 { font-size: 56px; }
      .cover-subtitle { color: ${tokens.accent}; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; margin-top: 24px; }
      .content { margin-top: 28px; max-width: 6.35in; }
      .prompt-stack { display: grid; gap: 18px; margin-top: 26px; }
      .prompt-card {
        min-height: 1.28in;
        border: 1px solid ${tokens.line};
        border-radius: 14px;
        background: rgba(255,255,255,0.54);
        padding: 18px 18px 14px;
      }
      .prompt-text { color: ${tokens.ink}; font-size: 12px; line-height: 1.4; font-weight: 600; margin-bottom: 12px; }
      .writing-lines { display: grid; gap: 16px; margin-top: 15px; }
      .writing-lines span { display: block; height: 1px; background: ${tokens.line}; }
      .check-row { display: grid; grid-template-columns: 18px 1fr; gap: 12px; align-items: start; padding: 12px 0; border-bottom: 1px solid ${tokens.line}; }
      .check-box { width: 16px; height: 16px; border: 1.5px solid ${tokens.sage}; border-radius: 4px; margin-top: 1px; }
      .tracker-table { width: 100%; border-collapse: collapse; margin-top: 30px; font-size: 11px; color: ${tokens.mutedInk}; }
      .tracker-table th { text-align: left; color: ${tokens.ink}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; padding: 10px; border: 1px solid ${tokens.line}; background: ${tokens.accentSoft}; }
      .tracker-table td { height: 42px; border: 1px solid ${tokens.line}; background: rgba(255,255,255,0.52); padding: 8px; }
      .reflection-space { height: 2.05in; border: 1px solid ${tokens.line}; border-radius: 14px; background: rgba(255,255,255,0.52); margin-top: 16px; }
      .bottom-note {
        position: absolute;
        left: 0.72in;
        right: 0.72in;
        bottom: 0.74in;
        color: ${tokens.mutedInk};
        border-top: 1px solid ${tokens.line};
        padding-top: 14px;
        font-size: 10.5px;
        line-height: 1.45;
      }
      .footer {
        position: absolute;
        left: 0.72in;
        right: 0.72in;
        bottom: 0.34in;
        display: flex;
        justify-content: space-between;
        color: ${tokens.mutedInk};
        font-size: 9px;
      }
      .wave {
        position: absolute;
        right: -0.1in;
        bottom: 0.38in;
        width: 3.3in;
        height: 1.55in;
        opacity: 0.82;
      }
      .page:not(.cover) .wave { opacity: 0.26; width: 2.1in; height: 0.95in; }
    </style>
  </head>
  <body>
    ${pages.join("\n")}
  </body>
</html>`
}

function renderPage(page: KitPage, index: number, total: number, kitTitle: string) {
  const pageTitle = page.title || titleFromType(page.rawType)

  if (page.type === "cover") {
    return `<section class="page cover">
      <div class="brand-mark">Best Collective<br />Brand LLC</div>
      <div class="cover-title">
        <h1>${escapeHtml(kitTitle || pageTitle)}</h1>
        <div class="cover-subtitle">${escapeHtml(page.section || "Digital Kit")}</div>
      </div>
      ${waveSvg()}
      ${footer(index, total)}
    </section>`
  }

  return `<section class="page ${escapeHtml(page.rawType)}">
    <div class="section-label">${escapeHtml(page.section || titleFromType(page.rawType))}</div>
    <h2>${escapeHtml(pageTitle)}</h2>
    <div class="content">${renderContent(page.content)}</div>
    ${renderFillableArea(page)}
    ${page.bottomNote ? `<div class="bottom-note">${escapeHtml(page.bottomNote)}</div>` : ""}
    ${waveSvg()}
    ${footer(index, total)}
  </section>`
}

function renderFillableArea(page: KitPage) {
  if (page.type === "checklist") {
    const items = page.prompts.length > 0 ? page.prompts : ["Item to complete"]

    return `<div class="prompt-stack">${items
      .map(
        (prompt) => `<div class="check-row"><span class="check-box"></span><span class="prompt-text">${escapeHtml(
          prompt
        )}</span></div>`
      )
      .join("")}</div>`
  }

  if (page.type === "tracker") {
    const rows = [0, 1, 2]

    return `<table class="tracker-table">
      <thead><tr><th>Step</th><th>Owner</th><th>Status</th><th>Notes</th></tr></thead>
      <tbody>${rows
        .map(
          () =>
            "<tr><td></td><td></td><td></td><td></td></tr>"
        )
        .join("")}</tbody>
    </table>`
  }

  if (page.type === "reflection") {
    return `<div class="prompt-stack">${page.prompts
      .map(
        (prompt) =>
          `<div><div class="prompt-text">${escapeHtml(prompt)}</div><div class="reflection-space"></div></div>`
      )
      .join("")}</div>`
  }

  if (page.type === "workbook") {
    return `<div class="prompt-stack">${page.prompts
      .map(
        (prompt) => `<div class="prompt-card"><div class="prompt-text">${escapeHtml(
          prompt
        )}</div><div class="writing-lines"><span></span><span></span><span></span></div></div>`
      )
      .join("")}</div>`
  }

  return ""
}

function renderContent(blocks: ContentBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === "paragraph") {
        return `<p>${escapeHtml(block.text)}</p>`
      }

      return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    })
    .join("")
}

function footer(index: number, total: number) {
  return `<div class="footer"><span>Best Collective Brand LLC</span><span>${index + 1} / ${total}</span></div>`
}

function titleFromType(type: string) {
  return type
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function waveSvg() {
  return `<svg class="wave" viewBox="0 0 340 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    ${Array.from({ length: 9 })
      .map((_, index) => {
        const y = 104 + index * 7
        return `<path d="M0 ${y} C70 ${y - 58}, 110 ${y + 46}, 180 ${y - 12} C238 ${y - 58}, 278 ${
          y + 18
        }, 340 ${y - 28}" stroke="#ea645e" stroke-width="1.35" />`
      })
      .join("")}
  </svg>`
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
    ["Poppins", "400", "poppins/files/poppins-latin-400-normal.woff2"],
    ["Poppins", "500", "poppins/files/poppins-latin-500-normal.woff2"],
    ["Poppins", "600", "poppins/files/poppins-latin-600-normal.woff2"],
    ["Lora", "700", "lora/files/lora-latin-700-normal.woff2"],
  ] as const

  return fonts
    .map(([family, weight, file]) => {
      const filePath = path.join(process.cwd(), "node_modules", "@fontsource", file)
      const data = fs.readFileSync(filePath).toString("base64")

      return `@font-face { font-family: "${family}"; font-weight: ${weight}; font-style: normal; font-display: swap; src: url(data:font/woff2;base64,${data}) format("woff2"); }`
    })
    .join("\n")
}
