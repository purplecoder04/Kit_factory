import "server-only"

import fs from "node:fs"
import path from "node:path"

import { type ContentBlock, type KitPage, type ParsedKit } from "@/lib/parser/pageTypes"
import { getBranchTokens } from "@/tokens"

const fontFaces = buildFontFaces()

export function buildKitHtml(kit: ParsedKit) {
  const tokens = getBranchTokens(kit.branch)
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
        padding: 0.74in 0.56in 0.66in;
      }
      .page:last-child { page-break-after: auto; }
      .page::before {
        content: "";
        position: absolute;
        inset: 0;
        border: 1px solid ${tokens.line};
        pointer-events: none;
      }
      .page-ribbon {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        height: 0.38in;
        display: flex;
        align-items: center;
        background: ${tokens.plum};
        color: #f8f1fb;
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.28em;
        padding: 0 0.32in;
        text-transform: uppercase;
      }
      .section-label {
        color: ${tokens.gold};
        font-size: 10px;
        letter-spacing: 0.26em;
        text-transform: uppercase;
        font-weight: 600;
        margin-bottom: 16px;
      }
      h1, h2 {
        font-family: "Cormorant Garamond", "Lora", Georgia, serif;
        font-weight: 700;
        color: ${tokens.ink};
        margin: 0;
      }
      h1 { font-size: 43px; line-height: 0.98; max-width: 4.3in; }
      h2 { font-size: 30px; line-height: 1.05; max-width: 6.2in; }
      p { color: ${tokens.mutedInk}; font-size: 12.5px; line-height: 1.65; margin: 0 0 12px; }
      ul { margin: 12px 0 0 18px; padding: 0; color: ${tokens.mutedInk}; font-size: 12.5px; line-height: 1.55; }
      li { margin-bottom: 8px; }
      .content { margin-top: 24px; max-width: 6.55in; }
      .cover {
        padding-top: 0.84in;
      }
      .cover-panel {
        position: relative;
        display: grid;
        place-items: center;
        min-height: 2.48in;
        border-radius: 8px;
        background: ${tokens.plum};
        color: #fffaf3;
        margin: 0.26in 0.18in 0;
        overflow: hidden;
        padding: 0.34in 0.58in;
        text-align: center;
      }
      .cover-panel::before {
        content: "";
        position: absolute;
        width: 3.05in;
        height: 1.04in;
        top: 0.32in;
        left: 1.1in;
        border-radius: 50%;
        border: 0.22in solid rgba(255, 255, 255, 0.08);
        transform: rotate(-6deg);
      }
      .cover-panel h1 {
        color: #fffaf3;
        font-size: 34px;
        max-width: 4.1in;
      }
      .cover-kicker {
        color: ${tokens.gold};
        font-size: 10px;
        letter-spacing: 0.45em;
        margin-bottom: 12px;
        text-transform: uppercase;
      }
      .cover-line {
        width: 0.72in;
        height: 1px;
        background: ${tokens.gold};
        margin: 14px auto 14px;
      }
      .cover-subtitle {
        color: rgba(255, 250, 243, 0.78);
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 15px;
        font-style: italic;
      }
      .cover-watermark {
        position: absolute;
        right: 0.28in;
        bottom: -0.08in;
        color: rgba(255, 255, 255, 0.07);
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 74px;
        font-weight: 700;
      }
      .prompt-stack { display: grid; gap: 16px; margin-top: 24px; }
      .prompt-card {
        min-height: 1.18in;
        border: 1px solid rgba(222, 211, 230, 0.72);
        border-left: 4px solid ${tokens.gold};
        border-radius: 8px;
        background: rgba(255, 253, 248, 0.72);
        padding: 16px 18px 13px;
      }
      .prompt-text {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        color: ${tokens.ink};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 18px;
        font-style: italic;
        font-weight: 600;
        line-height: 1.12;
        margin-bottom: 13px;
      }
      .prompt-text::before {
        content: "";
        width: 7px;
        height: 7px;
        flex: 0 0 auto;
        margin-top: 7px;
        background: ${tokens.gold};
        transform: rotate(45deg);
      }
      .writing-lines { display: grid; gap: 15px; margin-top: 14px; }
      .writing-lines span { display: block; height: 1px; background: ${tokens.line}; }
      .check-row { display: grid; grid-template-columns: 18px 1fr; gap: 12px; align-items: start; padding: 10px 0; border-bottom: 1px solid ${tokens.line}; }
      .check-row .prompt-text {
        display: block;
        font-family: "Poppins", Arial, sans-serif;
        font-size: 12.5px;
        font-style: normal;
        font-weight: 500;
        line-height: 1.45;
        margin: 0;
      }
      .check-row .prompt-text::before { display: none; }
      .check-box { width: 15px; height: 15px; border: 1.5px solid #d3c5eb; border-radius: 4px; margin-top: 1px; }
      .tracker-table { width: 100%; border-collapse: collapse; margin-top: 30px; font-size: 11px; color: ${tokens.mutedInk}; }
      .tracker-table th { text-align: left; color: ${tokens.ink}; font-size: 9px; text-transform: uppercase; letter-spacing: 0.16em; padding: 10px; border: 1px solid ${tokens.line}; background: ${tokens.lilac}; }
      .tracker-table td { height: 42px; border: 1px solid ${tokens.line}; background: rgba(255,255,255,0.45); padding: 8px; }
      .reflection-card {
        min-height: 1.78in;
        border-radius: 8px;
        background: ${tokens.plum};
        padding: 18px 20px 16px;
      }
      .reflection-card .prompt-text {
        color: #fffaf3;
        justify-content: center;
        text-align: center;
      }
      .reflection-card .prompt-text::before {
        background: #fffaf3;
      }
      .reflection-card .writing-lines span {
        background: rgba(255, 255, 255, 0.46);
      }
      .quote-box {
        position: relative;
        border-left: 4px solid ${tokens.plum};
        border-radius: 8px;
        background: ${tokens.lilac};
        margin: 16px 0;
        padding: 20px 22px 18px 42px;
      }
      .quote-mark {
        position: absolute;
        left: 14px;
        top: -2px;
        color: rgba(126, 95, 159, 0.22);
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 74px;
        font-weight: 700;
        line-height: 1;
      }
      .quote-text {
        color: ${tokens.ink};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 21px;
        font-style: italic;
        font-weight: 600;
        line-height: 1.18;
        margin: 0;
      }
      .quote-by {
        color: ${tokens.gold};
        font-size: 10px;
        letter-spacing: 0.18em;
        margin-top: 14px;
        padding-top: 10px;
        position: relative;
        text-transform: uppercase;
      }
      .quote-by::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        width: 0.72in;
        height: 1px;
        background: ${tokens.gold};
      }
      .key-term-box {
        border-left: 4px solid ${tokens.plum};
        border-radius: 8px;
        background: ${tokens.lilac};
        margin: 16px 0 12px;
        padding: 20px 22px;
      }
      .key-term-label {
        color: ${tokens.plum};
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.28em;
        margin-bottom: 8px;
        text-transform: uppercase;
      }
      .key-term-title {
        color: ${tokens.ink};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 25px;
        font-weight: 700;
        line-height: 1;
        margin-bottom: 8px;
      }
      .alert-box {
        display: grid;
        grid-template-columns: 24px 1fr;
        gap: 12px;
        align-items: start;
        border-left: 4px solid ${tokens.gold};
        border-radius: 8px;
        background: rgba(255, 253, 248, 0.74);
        margin: 12px 0;
        padding: 17px 18px;
      }
      .alert-icon {
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        background: ${tokens.gold};
        color: #fffaf3;
        font-size: 13px;
        font-weight: 700;
      }
      .alert-text {
        color: ${tokens.ink};
        font-size: 12px;
        line-height: 1.55;
      }
      .bottom-note {
        position: absolute;
        left: 0.56in;
        right: 0.56in;
        bottom: 0.74in;
        color: ${tokens.mutedInk};
        border-top: 1px solid ${tokens.line};
        padding-top: 14px;
        font-size: 10.5px;
        line-height: 1.45;
      }
      .footer {
        position: absolute;
        left: 0.56in;
        right: 0.56in;
        bottom: 0.34in;
        display: flex;
        justify-content: space-between;
        color: ${tokens.mutedInk};
        font-size: 9px;
      }
      .closing-panel {
        display: grid;
        place-items: center;
        min-height: 2.3in;
        border-radius: 8px;
        background: ${tokens.plum};
        color: #fffaf3;
        margin-top: 28px;
        padding: 0.32in 0.42in;
        text-align: center;
      }
      .closing-panel .diamond {
        width: 14px;
        height: 14px;
        background: #fffaf3;
        transform: rotate(45deg);
        margin: 0 auto 22px;
      }
      .closing-panel p {
        color: #fffaf3;
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 20px;
        font-style: italic;
        font-weight: 600;
        line-height: 1.3;
        margin: 0 auto;
        max-width: 5in;
      }
    </style>
  </head>
  <body>
    ${pages.join("\n")}
  </body>
</html>`
}

function renderPage(page: KitPage, index: number, total: number, kitTitle: string) {
  const pageTitle = page.title || titleFromType(page.rawType)
  const contentHtml =
    page.type === "closing"
      ? `<div class="closing-panel"><div><div class="diamond"></div>${renderContent(page.content)}</div></div>`
      : `<div class="content">${renderContent(page.content)}</div>`

  if (page.type === "cover") {
    return `<section class="page cover">
      <div class="page-ribbon">${escapeHtml(page.section || "Section Divider Page")}</div>
      <div class="cover-panel">
        <div>
          <div class="cover-kicker">${escapeHtml(page.section || "Part One")}</div>
          <h1>${escapeHtml(kitTitle || pageTitle)}</h1>
          <div class="cover-line"></div>
          <div class="cover-subtitle">Everything you need before you build the next layer.</div>
        </div>
        <div class="cover-watermark">${String(index + 1).padStart(2, "0")}</div>
      </div>
      ${footer(index, total)}
    </section>`
  }

  return `<section class="page ${escapeHtml(page.rawType)}">
    <div class="page-ribbon">${escapeHtml(page.section || titleFromType(page.rawType))}</div>
    <div class="section-label">${escapeHtml(page.section || titleFromType(page.rawType))}</div>
    <h2>${escapeHtml(pageTitle)}</h2>
    ${contentHtml}
    ${renderFillableArea(page)}
    ${page.bottomNote ? `<div class="bottom-note">${escapeHtml(page.bottomNote)}</div>` : ""}
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
          `<div class="reflection-card"><div class="prompt-text">${escapeHtml(
            prompt
          )}</div><div class="writing-lines"><span></span><span></span><span></span><span></span></div></div>`
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

      if (block.type === "quote") {
        return `<figure class="quote-box"><div class="quote-mark">&ldquo;</div><blockquote class="quote-text">${escapeHtml(
          block.text
        )}</blockquote>${
          block.attribution ? `<figcaption class="quote-by">${escapeHtml(block.attribution)}</figcaption>` : ""
        }</figure>`
      }

      if (block.type === "key-term") {
        return `<div class="key-term-box"><div class="key-term-label">Key Term</div><div class="key-term-title">${escapeHtml(
          block.term
        )}</div><p>${escapeHtml(block.text)}</p></div>`
      }

      if (block.type === "alert") {
        return `<div class="alert-box"><span class="alert-icon">!</span><div class="alert-text">${escapeHtml(
          block.text
        )}</div></div>`
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
    ["Poppins", "500", "normal", "poppins/files/poppins-latin-500-normal.woff2"],
    ["Poppins", "600", "normal", "poppins/files/poppins-latin-600-normal.woff2"],
    ["Lora", "700", "normal", "lora/files/lora-latin-700-normal.woff2"],
    [
      "Cormorant Garamond",
      "400",
      "italic",
      "cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff2",
    ],
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
