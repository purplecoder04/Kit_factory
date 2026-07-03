import "server-only"

import fs from "node:fs"
import path from "node:path"

import { type ContentBlock, type KitPage, type ParsedKit } from "@/lib/parser/pageTypes"
import {
  getBranchInfo,
  getDesignPreset,
  type BranchInfo,
  type DesignPresetTokens,
} from "@/tokens"

const fontFaces = buildFontFaces()

type RenderTarget = "guide" | "workbook" | "complete"

export function buildKitHtml(kit: ParsedKit, target: RenderTarget = "complete") {
  const preset = getDesignPreset(kit.designPreset, kit.branch)
  const branch = getBranchInfo(kit.branch)
  const pages = kit.pages.map((page, index) =>
    renderPage(page, index, kit.pages.length, kit, preset, branch, target)
  )

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(kit.title)}</title>
    <style>
      ${fontFaces}
      ${buildCss(preset)}
    </style>
  </head>
  <body>
    ${pages.join("\n")}
  </body>
</html>`
}

function buildCss(tokens: DesignPresetTokens) {
  const coverArt = buildCoverAssetDataUri(tokens)
  const brandCoverArt = tokens.styleFamily === "brand" ? coverArt : ""

  return `
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
        background:
          radial-gradient(circle at 90% 18%, ${transparent(tokens.accentSoft, 0.36)} 0 0.48in, transparent 0.5in),
          radial-gradient(circle at 8% 92%, ${transparent(tokens.lilac, 0.42)} 0 0.68in, transparent 0.7in),
          ${tokens.paper};
        padding: 0.72in 0.58in 0.68in;
      }
      .page:last-child { page-break-after: auto; }
      .page::before {
        content: "";
        position: absolute;
        inset: 0.14in;
        border: 1px solid ${tokens.line};
        border-radius: 0.08in;
        pointer-events: none;
        z-index: 1;
      }
      .page::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        opacity: 0.16;
        background-image:
          radial-gradient(${transparent(tokens.ink, 0.22)} 0.42px, transparent 0.5px),
          radial-gradient(${transparent(tokens.paperAlt, 0.7)} 0.45px, transparent 0.55px);
        background-position: 0 0, 0.04in 0.05in;
        background-size: 0.08in 0.08in, 0.1in 0.1in;
      }
      .page > * { position: relative; z-index: 2; }
      .decor {
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
      }
      .decor::before,
      .decor::after {
        content: "";
        position: absolute;
        border-radius: 999px;
      }
      .decor::before {
        width: 2.18in;
        height: 2.18in;
        right: -0.72in;
        bottom: -0.46in;
        background: ${transparent(tokens.plum, 0.12)};
      }
      .decor::after {
        width: 1.46in;
        height: 1.46in;
        left: -0.58in;
        top: -0.42in;
        background: ${transparent(tokens.accent, 0.08)};
      }
      .dots {
        position: absolute;
        right: 0.42in;
        top: 0.44in;
        width: 0.46in;
        height: 0.42in;
        background-image: radial-gradient(${tokens.accent} 1.15px, transparent 1.3px);
        background-size: 0.1in 0.1in;
        opacity: 0.42;
      }
      .swoop {
        position: absolute;
        left: -0.34in;
        bottom: -0.44in;
        width: 3.1in;
        height: 3.1in;
        border: 1px solid ${transparent(tokens.gold, 0.42)};
        border-radius: 50%;
      }
      .watercolor,
      .mountain-mark,
      .tool-mark,
      .road-mark,
      .floral,
      .spark-lines,
      .brand-arc,
      .brand-cup,
      .brand-card,
      .brand-laptop,
      .brand-plant,
      .brand-door,
      .brand-book,
      .brand-light,
      .brand-pen,
      .brand-glasses,
      .rise-glass,
      .rise-cake,
      .rise-crown,
      .land-compass,
      .land-wrench,
      .land-leaf,
      .rebuild-boxes,
      .rebuild-paint,
      .rebuild-frame,
      .heal-heart,
      .heal-journals,
      .heal-sun {
        display: none;
        position: absolute;
      }
      .brand-arc,
      .brand-cup,
      .brand-card,
      .brand-laptop,
      .brand-plant,
      .brand-door,
      .brand-book,
      .brand-light,
      .brand-pen,
      .brand-glasses,
      .rise-glass,
      .rise-cake,
      .rise-crown,
      .land-compass,
      .land-wrench,
      .land-leaf,
      .rebuild-boxes,
      .rebuild-paint,
      .rebuild-frame,
      .heal-heart,
      .heal-journals,
      .heal-sun {
        pointer-events: none;
      }
      .watercolor {
        border-radius: 46% 54% 48% 52%;
        filter: blur(0.5px);
        opacity: 0.82;
      }
      .floral {
        color: ${tokens.rose};
        width: 0.72in;
        height: 1.72in;
      }
      .floral::before {
        content: "";
        position: absolute;
        left: 0.34in;
        top: 0.08in;
        width: 1px;
        height: 1.42in;
        background: currentColor;
        transform: rotate(13deg);
        opacity: 0.45;
      }
      .floral::after {
        content: "";
        position: absolute;
        left: 0.2in;
        top: 0.2in;
        width: 0.08in;
        height: 0.08in;
        border-radius: 50%;
        background: currentColor;
        box-shadow:
          0.22in 0.2in 0 -0.005in currentColor,
          -0.05in 0.48in 0 -0.008in currentColor,
          0.24in 0.72in 0 -0.01in currentColor,
          0.02in 1.02in 0 -0.006in currentColor;
        opacity: 0.5;
      }
      .mountain-mark {
        width: 2.35in;
        height: 1.05in;
        right: 0.18in;
        bottom: 0.62in;
        background:
          linear-gradient(138deg, transparent 0 43%, ${transparent(tokens.plum, 0.26)} 43.4% 44.5%, transparent 45%),
          linear-gradient(42deg, transparent 0 48%, ${transparent(tokens.plum, 0.2)} 48.4% 49.4%, transparent 50%),
          linear-gradient(145deg, transparent 0 56%, ${transparent(tokens.accent, 0.18)} 56.4% 57.2%, transparent 58%);
        clip-path: polygon(0 86%, 18% 52%, 31% 68%, 50% 24%, 70% 70%, 84% 48%, 100% 84%, 100% 100%, 0 100%);
      }
      .tool-mark {
        width: 1.18in;
        height: 1.18in;
        right: 0.58in;
        bottom: 1.2in;
        opacity: 0.2;
      }
      .tool-mark::before,
      .tool-mark::after {
        content: "";
        position: absolute;
        left: 0.52in;
        top: 0.05in;
        width: 0.08in;
        height: 1.05in;
        border-radius: 999px;
        background: ${tokens.rose};
        transform-origin: center;
      }
      .tool-mark::before { transform: rotate(42deg); }
      .tool-mark::after { transform: rotate(-42deg); }
      .road-mark {
        width: 3.1in;
        height: 1.22in;
        left: 50%;
        bottom: 0.62in;
        transform: translateX(-50%);
        opacity: 0.28;
        background:
          radial-gradient(ellipse at 42% 110%, transparent 0 42%, ${transparent(tokens.gold, 0.82)} 42.6% 43.4%, transparent 44%),
          radial-gradient(ellipse at 58% 110%, transparent 0 42%, ${transparent(tokens.rose, 0.5)} 42.6% 43.4%, transparent 44%);
      }
      .spark-lines {
        width: 2.1in;
        height: 2.1in;
        right: -0.25in;
        top: -0.2in;
        opacity: 0.34;
        background:
          repeating-linear-gradient(148deg, transparent 0 0.12in, ${transparent(tokens.gold, 0.8)} 0.13in 0.14in, transparent 0.15in 0.25in);
      }
      .brand-arc {
        width: 2.7in;
        height: 2.7in;
        border: 1px solid ${transparent(tokens.gold, 0.72)};
        border-radius: 50%;
        opacity: 0.72;
      }
      .brand-cup {
        width: 0.82in;
        height: 0.82in;
        border-radius: 50%;
        border: 0.1in solid ${transparent(tokens.ink, 0.9)};
        background:
          radial-gradient(circle at 52% 52%, ${transparent(tokens.gold, 0.28)} 0 0.18in, transparent 0.19in),
          ${transparent(tokens.paper, 0.88)};
        box-shadow: 0 0.08in 0.18in ${transparent(tokens.ink, 0.16)};
      }
      .brand-cup::after {
        content: "";
        position: absolute;
        right: -0.22in;
        top: 0.24in;
        width: 0.25in;
        height: 0.25in;
        border: 0.05in solid ${transparent(tokens.ink, 0.72)};
        border-left: 0;
        border-radius: 0 999px 999px 0;
      }
      .brand-card,
      .brand-book {
        width: 1.28in;
        height: 0.74in;
        border: 1px solid ${tokens.line};
        border-radius: 0.04in;
        background: ${transparent(tokens.paper, 0.92)};
        box-shadow: 0 0.07in 0.18in ${transparent(tokens.ink, 0.12)};
      }
      .brand-card::before,
      .brand-book::before {
        content: "";
        position: absolute;
        left: 0.18in;
        right: 0.18in;
        top: 0.24in;
        height: 1px;
        background: ${tokens.accent};
        box-shadow: 0 0.14in 0 ${transparent(tokens.ink, 0.24)};
      }
      .brand-laptop {
        width: 1.42in;
        height: 0.95in;
        border-radius: 0.04in;
        background: ${transparent(tokens.ink, 0.9)};
        box-shadow: 0 0.1in 0.18in ${transparent(tokens.ink, 0.16)};
      }
      .brand-laptop::after {
        content: "";
        position: absolute;
        left: -0.08in;
        right: -0.08in;
        bottom: -0.16in;
        height: 0.12in;
        border-radius: 0.02in;
        background: ${transparent(tokens.ink, 0.74)};
      }
      .brand-plant {
        width: 0.72in;
        height: 1.36in;
      }
      .brand-plant::before {
        content: "";
        position: absolute;
        left: 0.23in;
        bottom: 0.06in;
        width: 0.32in;
        height: 0.32in;
        border-radius: 0 0 0.08in 0.08in;
        background: ${transparent(tokens.gold, 0.52)};
        box-shadow: 0 0.06in 0.15in ${transparent(tokens.ink, 0.1)};
      }
      .brand-plant::after {
        content: "";
        position: absolute;
        left: 0.12in;
        bottom: 0.36in;
        width: 0.52in;
        height: 0.82in;
        background:
          radial-gradient(ellipse at 28% 20%, ${transparent(tokens.sage, 0.72)} 0 0.09in, transparent 0.095in),
          radial-gradient(ellipse at 73% 36%, ${transparent(tokens.sage, 0.68)} 0 0.09in, transparent 0.095in),
          radial-gradient(ellipse at 24% 54%, ${transparent(tokens.sage, 0.62)} 0 0.085in, transparent 0.09in),
          radial-gradient(ellipse at 72% 72%, ${transparent(tokens.sage, 0.58)} 0 0.08in, transparent 0.085in),
          linear-gradient(${tokens.sage}, ${tokens.sage});
        background-repeat: no-repeat;
        background-size:
          0.24in 0.15in,
          0.24in 0.15in,
          0.22in 0.14in,
          0.22in 0.14in,
          1px 0.82in;
        background-position:
          0 0.1in,
          0.24in 0.24in,
          0.02in 0.42in,
          0.24in 0.58in,
          center top;
        box-shadow: none;
      }
      .brand-door {
        width: 1.18in;
        height: 1.76in;
        border: 0.06in solid ${transparent(tokens.line, 0.9)};
        border-radius: 0.58in 0.58in 0.06in 0.06in;
        background:
          linear-gradient(90deg, transparent 49%, ${transparent(tokens.line, 0.72)} 49.5% 50.5%, transparent 51%),
          ${transparent(tokens.paperAlt, 0.74)};
      }
      .brand-door::after {
        content: "";
        position: absolute;
        right: 0.2in;
        top: 0.86in;
        width: 0.06in;
        height: 0.06in;
        border-radius: 50%;
        background: ${tokens.accent};
      }
      .brand-light {
        width: 0.5in;
        height: 1.6in;
        color: ${tokens.accent};
      }
      .brand-light::before {
        content: "";
        position: absolute;
        left: 50%;
        top: 0;
        width: 1px;
        height: 0.98in;
        background: ${transparent(tokens.ink, 0.46)};
      }
      .brand-light::after {
        content: "";
        position: absolute;
        left: 50%;
        top: 0.84in;
        width: 0.34in;
        height: 0.42in;
        border-radius: 50% 50% 44% 44%;
        transform: translateX(-50%);
        background:
          radial-gradient(circle at 50% 45%, ${transparent(tokens.paper, 0.94)} 0 0.12in, transparent 0.13in),
          linear-gradient(to bottom, ${transparent(tokens.gold, 0.58)}, ${transparent(tokens.gold, 0.28)});
        border: 1px solid ${transparent(tokens.gold, 0.72)};
        box-shadow: 0 0.1in 0.26in ${transparent(tokens.gold, 0.24)};
      }
      .brand-pen {
        width: 1.56in;
        height: 0.15in;
        border-radius: 999px;
        background:
          linear-gradient(90deg, ${tokens.ink} 0 0.18in, ${transparent(tokens.gold, 0.86)} 0.19in 0.36in, ${transparent(tokens.paper, 0.94)} 0.37in 1.34in, ${tokens.ink} 1.35in);
        border: 1px solid ${transparent(tokens.line, 0.7)};
        box-shadow: 0 0.07in 0.18in ${transparent(tokens.ink, 0.13)};
      }
      .brand-glasses {
        width: 1.32in;
        height: 0.45in;
        color: ${tokens.ink};
      }
      .brand-glasses::before,
      .brand-glasses::after {
        content: "";
        position: absolute;
        top: 0.04in;
        width: 0.42in;
        height: 0.28in;
        border: 0.035in solid ${transparent(tokens.ink, 0.56)};
        border-radius: 999px;
        background: ${transparent(tokens.paper, 0.38)};
      }
      .brand-glasses::before { left: 0.12in; }
      .brand-glasses::after { right: 0.12in; }
      .brand-glasses {
        background:
          linear-gradient(90deg, transparent 0 43%, ${transparent(tokens.ink, 0.56)} 44% 56%, transparent 57%);
      }
      .rise-glass {
        width: 0.7in;
        height: 1.42in;
      }
      .rise-glass::before {
        content: "";
        position: absolute;
        left: 0.16in;
        top: 0.04in;
        width: 0.38in;
        height: 0.58in;
        border: 0.035in solid ${transparent(tokens.rose, 0.72)};
        border-top-width: 0.05in;
        border-radius: 0.12in 0.12in 0.2in 0.2in;
        background:
          linear-gradient(to top, ${transparent(tokens.accent, 0.42)} 0 45%, transparent 46%);
      }
      .rise-glass::after {
        content: "";
        position: absolute;
        left: 0.33in;
        top: 0.63in;
        width: 1px;
        height: 0.5in;
        background: ${transparent(tokens.rose, 0.72)};
        box-shadow:
          -0.16in 0.52in 0 -0.01in ${transparent(tokens.rose, 0.72)},
          0.16in 0.52in 0 -0.01in ${transparent(tokens.rose, 0.72)};
      }
      .rise-cake {
        width: 1.02in;
        height: 0.78in;
        border-radius: 0.08in 0.08in 0.04in 0.04in;
        background:
          radial-gradient(circle at 78% 12%, ${transparent(tokens.rose, 0.72)} 0 0.08in, transparent 0.085in),
          linear-gradient(to bottom, ${transparent(tokens.paper, 0.92)} 0 30%, ${transparent(tokens.rose, 0.26)} 31% 48%, ${transparent(tokens.paper, 0.92)} 49% 68%, ${transparent(tokens.rose, 0.28)} 69%);
        border: 1px solid ${transparent(tokens.accent, 0.34)};
        box-shadow: 0 0.08in 0.16in ${transparent(tokens.ink, 0.1)};
      }
      .rise-cake::after {
        content: "";
        position: absolute;
        left: 0.12in;
        right: 0.12in;
        bottom: -0.08in;
        height: 0.04in;
        border-radius: 999px;
        background: ${transparent(tokens.accent, 0.36)};
      }
      .rise-crown {
        width: 0.42in;
        height: 0.28in;
      }
      .rise-crown::before {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 0.22in;
        background: ${transparent(tokens.accent, 0.9)};
        clip-path: polygon(0 88%, 13% 34%, 32% 64%, 50% 8%, 68% 64%, 87% 34%, 100% 88%, 100% 100%, 0 100%);
      }
      .rise-crown::after {
        content: "";
        position: absolute;
        left: 0.06in;
        right: 0.06in;
        bottom: -0.03in;
        height: 0.025in;
        border-radius: 999px;
        background: ${transparent(tokens.accent, 0.9)};
      }
      .land-compass {
        width: 0.86in;
        height: 0.86in;
        border: 0.035in solid ${transparent(tokens.gold, 0.82)};
        border-radius: 50%;
        background:
          radial-gradient(circle at 50% 50%, ${transparent(tokens.gold, 0.58)} 0 0.045in, transparent 0.05in),
          ${transparent(tokens.paper, 0.72)};
        box-shadow: 0 0.08in 0.16in ${transparent(tokens.ink, 0.12)};
      }
      .land-compass::before {
        content: "";
        position: absolute;
        left: 0.34in;
        top: 0.14in;
        width: 0.12in;
        height: 0.52in;
        background: ${transparent(tokens.plum, 0.82)};
        clip-path: polygon(50% 0, 100% 47%, 58% 47%, 58% 100%, 42% 100%, 42% 47%, 0 47%);
        transform: rotate(38deg);
        transform-origin: center;
      }
      .land-compass::after {
        content: "";
        position: absolute;
        inset: 0.16in;
        border: 1px solid ${transparent(tokens.gold, 0.34)};
        border-radius: 50%;
      }
      .land-wrench {
        width: 1.18in;
        height: 0.26in;
        border-radius: 999px;
        background: linear-gradient(90deg, ${transparent(tokens.rose, 0.82)}, ${transparent(tokens.ink, 0.72)});
        box-shadow: 0 0.08in 0.13in ${transparent(tokens.ink, 0.12)};
      }
      .land-wrench::before {
        content: "";
        position: absolute;
        left: -0.18in;
        top: -0.16in;
        width: 0.42in;
        height: 0.42in;
        border: 0.07in solid ${transparent(tokens.ink, 0.72)};
        border-right-color: transparent;
        border-radius: 50%;
        transform: rotate(-25deg);
      }
      .land-wrench::after {
        content: "";
        position: absolute;
        right: -0.06in;
        top: 0.07in;
        width: 0.16in;
        height: 0.16in;
        border: 0.045in solid ${transparent(tokens.gold, 0.72)};
        border-radius: 50%;
        background: ${transparent(tokens.paper, 0.62)};
      }
      .land-leaf {
        width: 0.92in;
        height: 1.2in;
      }
      .land-leaf::before {
        content: "";
        position: absolute;
        left: 0.43in;
        bottom: 0;
        width: 1px;
        height: 1.08in;
        background: ${transparent(tokens.sage, 0.72)};
        transform: rotate(7deg);
      }
      .land-leaf::after {
        content: "";
        position: absolute;
        left: 0.1in;
        top: 0.12in;
        width: 0.68in;
        height: 0.84in;
        background:
          radial-gradient(ellipse at 30% 18%, ${transparent(tokens.sage, 0.8)} 0 0.12in, transparent 0.125in),
          radial-gradient(ellipse at 72% 30%, ${transparent(tokens.sage, 0.72)} 0 0.12in, transparent 0.125in),
          radial-gradient(ellipse at 25% 52%, ${transparent(tokens.sage, 0.66)} 0 0.11in, transparent 0.115in),
          radial-gradient(ellipse at 70% 68%, ${transparent(tokens.sage, 0.6)} 0 0.1in, transparent 0.105in);
        background-repeat: no-repeat;
      }
      .rebuild-boxes {
        width: 1.24in;
        height: 1in;
      }
      .rebuild-boxes::before,
      .rebuild-boxes::after {
        content: "";
        position: absolute;
        border: 1px solid ${transparent(tokens.gold, 0.55)};
        border-radius: 0.04in;
        background:
          linear-gradient(90deg, transparent 0 47%, ${transparent(tokens.gold, 0.28)} 47.5% 52.5%, transparent 53%),
          ${transparent(tokens.paperAlt, 0.86)};
        box-shadow: 0 0.08in 0.16in ${transparent(tokens.ink, 0.1)};
      }
      .rebuild-boxes::before {
        left: 0.08in;
        bottom: 0;
        width: 0.72in;
        height: 0.52in;
      }
      .rebuild-boxes::after {
        right: 0.06in;
        bottom: 0.34in;
        width: 0.74in;
        height: 0.5in;
      }
      .rebuild-paint {
        width: 0.64in;
        height: 0.78in;
        border: 1px solid ${transparent(tokens.blue, 0.68)};
        border-radius: 0.05in 0.05in 0.12in 0.12in;
        background:
          linear-gradient(to top, ${transparent(tokens.blue, 0.34)} 0 44%, ${transparent(tokens.paper, 0.88)} 45%),
          ${transparent(tokens.paper, 0.74)};
        box-shadow: 0 0.08in 0.14in ${transparent(tokens.ink, 0.1)};
      }
      .rebuild-paint::before {
        content: "";
        position: absolute;
        left: 0.1in;
        right: 0.1in;
        top: -0.16in;
        height: 0.24in;
        border: 0.035in solid ${transparent(tokens.gold, 0.72)};
        border-bottom: 0;
        border-radius: 0.2in 0.2in 0 0;
      }
      .rebuild-paint::after {
        content: "";
        position: absolute;
        right: -0.34in;
        top: 0.18in;
        width: 0.5in;
        height: 0.06in;
        border-radius: 999px;
        background: ${transparent(tokens.gold, 0.78)};
        transform: rotate(-28deg);
      }
      .rebuild-frame {
        width: 0.94in;
        height: 1.08in;
        border: 0.045in solid ${transparent(tokens.gold, 0.62)};
        border-radius: 0.04in;
        background:
          linear-gradient(${transparent(tokens.paper, 0.72)}, ${transparent(tokens.paper, 0.72)}),
          radial-gradient(circle at 50% 20%, ${transparent(tokens.rose, 0.22)}, transparent 0.38in);
        box-shadow: 0 0.08in 0.16in ${transparent(tokens.ink, 0.1)};
      }
      .rebuild-frame::before {
        content: "new";
        position: absolute;
        left: 0;
        right: 0;
        top: 0.38in;
        color: ${transparent(tokens.ink, 0.78)};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 16px;
        font-style: italic;
        text-align: center;
      }
      .heal-heart {
        width: 0.42in;
        height: 0.42in;
        transform: rotate(-45deg);
        background: ${transparent(tokens.rose, 0.76)};
        border-radius: 0.04in;
      }
      .heal-heart::before,
      .heal-heart::after {
        content: "";
        position: absolute;
        width: 0.42in;
        height: 0.42in;
        border-radius: 50%;
        background: inherit;
      }
      .heal-heart::before {
        top: -0.21in;
        left: 0;
      }
      .heal-heart::after {
        top: 0;
        left: 0.21in;
      }
      .heal-journals {
        width: 1.08in;
        height: 0.72in;
      }
      .heal-journals::before,
      .heal-journals::after {
        content: "";
        position: absolute;
        border: 1px solid ${transparent(tokens.gold, 0.58)};
        border-radius: 0.04in;
        background: ${transparent(tokens.paperAlt, 0.86)};
        box-shadow: 0 0.06in 0.14in ${transparent(tokens.ink, 0.1)};
      }
      .heal-journals::before {
        left: 0.06in;
        top: 0.18in;
        width: 0.86in;
        height: 0.42in;
        transform: rotate(-4deg);
      }
      .heal-journals::after {
        left: 0.18in;
        top: 0.04in;
        width: 0.78in;
        height: 0.44in;
        transform: rotate(5deg);
      }
      .heal-sun {
        width: 0.58in;
        height: 0.32in;
        border-bottom: 0.03in solid ${transparent(tokens.gold, 0.78)};
      }
      .heal-sun::before {
        content: "";
        position: absolute;
        left: 0.18in;
        bottom: -0.02in;
        width: 0.22in;
        height: 0.22in;
        border-radius: 50% 50% 0 0;
        border: 0.035in solid ${transparent(tokens.gold, 0.78)};
        border-bottom: 0;
      }
      .heal-sun::after {
        content: "";
        position: absolute;
        left: 0.04in;
        right: 0.04in;
        bottom: 0.03in;
        height: 0.12in;
        background:
          linear-gradient(90deg, transparent 0 8%, ${transparent(tokens.gold, 0.72)} 9% 10%, transparent 11% 25%, ${transparent(tokens.gold, 0.72)} 26% 27%, transparent 28% 42%, ${transparent(tokens.gold, 0.72)} 43% 44%, transparent 45% 59%, ${transparent(tokens.gold, 0.72)} 60% 61%, transparent 62% 76%, ${transparent(tokens.gold, 0.72)} 77% 78%, transparent 79%);
      }
      .style-brand .decor::before {
        width: 2.8in;
        height: 2.8in;
        right: -1.04in;
        bottom: -0.84in;
        background: ${transparent(tokens.plum, 0.22)};
      }
      .style-brand .decor::after {
        width: 1.9in;
        height: 1.9in;
        left: -0.58in;
        top: -0.42in;
        background: ${transparent(tokens.plum, 0.3)};
      }
      .style-brand:not(.cover) .decor::after {
        left: -0.78in;
        top: -0.78in;
        opacity: 0.74;
      }
      .style-brand:not(.cover) {
        padding: 0.78in 0.68in 0.62in;
        background:
          radial-gradient(circle at -4% 2%, ${transparent(tokens.plum, 0.34)} 0 0.75in, transparent 0.77in),
          radial-gradient(circle at 15% 8%, ${transparent(tokens.lilac, 0.22)} 0 0.92in, transparent 0.94in),
          radial-gradient(circle at 96% 3%, ${transparent(tokens.plum, 0.22)} 0 0.56in, transparent 0.58in),
          radial-gradient(circle at 104% 101%, ${transparent(tokens.plum, 0.2)} 0 1.24in, transparent 1.26in),
          radial-gradient(ellipse at 8% 80%, ${transparent(tokens.accent, 0.08)}, transparent 1.42in),
          linear-gradient(126deg, transparent 0 70%, ${transparent(tokens.lilac, 0.12)} 70.4% 100%),
          linear-gradient(172deg, ${transparent(tokens.paperAlt, 0.2)} 0 10%, transparent 28%),
          ${tokens.paper};
      }
      .style-brand:not(.cover)::before {
        border-color: ${transparent(tokens.line, 0.78)};
        inset: 0.18in;
      }
      .style-brand:not(.cover)::after {
        opacity: 0.12;
      }
      .style-brand:not(.cover) .dots {
        display: block;
        right: 0.52in;
        top: 0.48in;
        opacity: 0.5;
      }
      .style-brand:not(.cover) .swoop {
        display: block;
        left: -0.46in;
        bottom: -0.18in;
        opacity: 0.74;
      }
      .style-brand:not(.cover) .decor::before {
        right: -0.9in;
        bottom: -0.6in;
        opacity: 0.42;
      }
      .style-brand:not(.cover) .decor::after {
        left: -0.76in;
        top: -0.72in;
        opacity: 0.42;
      }
      .style-brand:not(.cover):not(.type-section-divider):not(.type-quote):not(.type-closing) {
        background:
          radial-gradient(circle at -4% 2%, ${transparent(tokens.plum, 0.34)} 0 0.75in, transparent 0.77in),
          radial-gradient(circle at 15% 8%, ${transparent(tokens.lilac, 0.22)} 0 0.92in, transparent 0.94in),
          radial-gradient(circle at 96% 3%, ${transparent(tokens.plum, 0.2)} 0 0.54in, transparent 0.56in),
          radial-gradient(circle at 104% 101%, ${transparent(tokens.plum, 0.18)} 0 1.18in, transparent 1.2in),
          radial-gradient(ellipse at 6% 82%, ${transparent(tokens.accent, 0.08)}, transparent 1.38in),
          linear-gradient(126deg, transparent 0 70%, ${transparent(tokens.lilac, 0.12)} 70.4% 100%),
          linear-gradient(172deg, ${transparent(tokens.paperAlt, 0.18)} 0 10%, transparent 28%),
          ${tokens.paper};
      }
      .style-brand:not(.cover):not(.type-section-divider):not(.type-quote):not(.type-closing) h2 {
        color: ${tokens.ink};
        font-size: 43px;
        line-height: 0.92;
        max-width: 6.18in;
      }
      .style-brand:not(.cover):not(.type-section-divider):not(.type-quote):not(.type-closing) .section-label {
        color: ${tokens.accent};
        font-size: 9px;
        letter-spacing: 0.3em;
        margin-bottom: 0.12in;
      }
      .style-brand:not(.cover):not(.type-section-divider):not(.type-quote):not(.type-closing) .content {
        color: ${tokens.mutedInk};
        font-size: 12.4px;
      }
      .style-brand:not(.cover):not(.type-section-divider):not(.type-quote):not(.type-closing) p {
        font-size: 12.8px;
        line-height: 1.6;
      }
      .style-brand.motif-grounded-circles .spark-lines {
        display: block;
      }
      .style-brand.motif-grounded-circles .decor::before {
        background: ${transparent(tokens.sage, 0.24)};
      }
      .style-brand:not(.cover) .spark-lines {
        display: block;
        right: -0.18in;
        top: 0.16in;
        opacity: 0.18;
        transform: rotate(-10deg);
      }
      .style-brand:not(.cover) .brand-arc {
        display: block;
        left: -0.54in;
        bottom: 0.82in;
        width: 2.65in;
        height: 2.65in;
        opacity: 0.46;
      }
      .style-brand:not(.cover) .brand-cup,
      .style-brand:not(.cover) .brand-card,
      .style-brand:not(.cover) .brand-laptop,
      .style-brand:not(.cover) .brand-plant,
      .style-brand:not(.cover) .brand-door,
      .style-brand:not(.cover) .brand-book,
      .style-brand:not(.cover) .brand-light,
      .style-brand:not(.cover) .brand-pen,
      .style-brand:not(.cover) .brand-glasses {
        filter: drop-shadow(0 0.06in 0.12in ${transparent(tokens.ink, 0.12)});
      }
      .style-rise .wash-a,
      .style-meetatheal.motif-rose-ribbons .wash-a {
        display: block;
        width: 2.8in;
        height: 3.2in;
        right: -0.8in;
        top: -0.42in;
        transform: rotate(24deg);
        background:
          linear-gradient(116deg, transparent 0 22%, ${transparent(tokens.rose, 0.14)} 22% 54%, transparent 55%),
          linear-gradient(126deg, transparent 0 34%, ${transparent(tokens.accent, 0.18)} 34% 64%, transparent 65%);
      }
      .style-rise .wash-b,
      .style-meetatheal.motif-rose-ribbons .wash-b {
        display: block;
        width: 2.2in;
        height: 3.1in;
        left: -0.62in;
        bottom: -0.72in;
        transform: rotate(-25deg);
        background:
          linear-gradient(112deg, transparent 0 28%, ${transparent(tokens.lilac, 0.18)} 28% 62%, transparent 63%),
          linear-gradient(122deg, transparent 0 45%, ${transparent(tokens.accent, 0.12)} 45% 70%, transparent 71%);
      }
      .style-rise .floral-right,
      .style-meetatheal.motif-rose-ribbons .floral-right {
        display: block;
        right: 0.34in;
        bottom: 1.08in;
      }
      .style-rise .floral-left,
      .style-meetatheal.motif-rose-ribbons .floral-left {
        display: block;
        left: 0.22in;
        top: 1.28in;
        transform: scaleX(-1);
        opacity: 0.78;
      }
      .style-land .mountain-mark {
        display: block;
      }
      .style-land .tool-mark {
        display: none;
      }
      .style-land .spark-lines {
        display: block;
        left: 0.12in;
        right: auto;
        top: -0.2in;
        transform: rotate(8deg);
      }
      .style-rebuild .wash-a {
        display: block;
        width: 3.3in;
        height: 2.1in;
        right: -0.82in;
        top: -0.22in;
        transform: rotate(-18deg);
        background:
          radial-gradient(ellipse at 35% 45%, ${transparent(tokens.blue, 0.24)}, transparent 62%),
          radial-gradient(ellipse at 68% 52%, ${transparent(tokens.rose, 0.18)}, transparent 56%);
      }
      .style-rebuild .wash-b {
        display: block;
        width: 2.6in;
        height: 2.4in;
        left: -0.8in;
        bottom: -0.72in;
        transform: rotate(14deg);
        background:
          radial-gradient(ellipse at 55% 45%, ${transparent(tokens.lilac, 0.22)}, transparent 62%),
          radial-gradient(ellipse at 32% 70%, ${transparent(tokens.sage, 0.16)}, transparent 50%);
      }
      .style-rebuild .spark-lines {
        display: block;
      }
      .style-rebuild .floral-right {
        display: block;
        color: ${tokens.sage};
        right: 0.36in;
        bottom: 1in;
      }
      .style-meetatheal.motif-roads-hearts .road-mark,
      .style-meetatheal.motif-roads-hearts .mountain-mark,
      .style-meetatheal.motif-roads-hearts .floral-left,
      .style-meetatheal.motif-roads-hearts .floral-right {
        display: block;
      }
      .style-meetatheal.motif-roads-hearts .floral-left {
        left: 0.18in;
        bottom: 1.15in;
        color: ${tokens.sage};
      }
      .style-meetatheal.motif-roads-hearts .floral-right {
        right: 0.18in;
        top: 1.05in;
        color: ${tokens.rose};
      }
      .style-meetatheal.motif-roads-hearts:not(.cover) {
        background:
          linear-gradient(116deg, ${transparent(tokens.sage, 0.2)} 0 24%, transparent 47%),
          linear-gradient(64deg, transparent 0 54%, ${transparent(tokens.rose, 0.18)} 77%, transparent 100%),
          radial-gradient(ellipse at 17% 77%, ${transparent(tokens.blue, 0.2)}, transparent 42%),
          radial-gradient(ellipse at 84% 75%, ${transparent(tokens.rose, 0.18)}, transparent 42%),
          radial-gradient(ellipse at 50% 96%, ${transparent(tokens.gold, 0.1)}, transparent 36%),
          ${tokens.paper};
      }
      .style-meetatheal.motif-roads-hearts:not(.cover) .mountain-mark {
        left: -0.18in;
        right: auto;
        bottom: 0.8in;
        width: 3.28in;
        height: 1.48in;
        opacity: 0.32;
      }
      .style-meetatheal.motif-roads-hearts:not(.cover) .road-mark {
        width: 4.2in;
        height: 1.46in;
        bottom: 0.72in;
        opacity: 0.42;
      }
      .style-meetatheal.motif-roads-hearts:not(.cover) .floral-left {
        left: 0.1in;
        bottom: 0.7in;
        transform: scale(1.02);
        opacity: 0.56;
      }
      .style-meetatheal.motif-roads-hearts:not(.cover) .floral-right {
        right: 0.18in;
        top: 1.22in;
        transform: scale(1.16);
        opacity: 0.72;
      }
      .style-meetatheal.motif-roads-hearts:not(.cover) .spark-lines {
        display: block;
        left: -0.18in;
        right: auto;
        top: -0.18in;
        opacity: 0.2;
        transform: rotate(8deg);
      }
      .style-land .swoop,
      .style-rebuild .swoop {
        border-radius: 0;
        border: 0;
        background:
          linear-gradient(132deg, transparent 0 44%, ${transparent(tokens.gold, 0.48)} 44.3% 44.7%, transparent 45%),
          linear-gradient(146deg, transparent 0 54%, ${transparent(tokens.gold, 0.42)} 54.3% 54.7%, transparent 55%);
      }
      .style-rise .decor::before,
      .style-meetatheal .decor::before {
        width: 2.42in;
        height: 1.7in;
        transform: rotate(-22deg);
        background: ${transparent(tokens.rose, 0.18)};
      }
      .style-rebuild .decor::before {
        background: ${transparent(tokens.blue, 0.2)};
      }
      .style-land .decor::before {
        border-radius: 0;
        clip-path: polygon(0 78%, 28% 42%, 48% 66%, 72% 28%, 100% 74%, 100% 100%, 0 100%);
        background: ${transparent(tokens.plum, 0.22)};
      }
      .page-ribbon {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        min-height: 0.32in;
        display: flex;
        align-items: center;
        background: ${tokens.plum};
        color: ${tokens.paper};
        font-size: 8.8px;
        font-weight: 700;
        letter-spacing: 0.28em;
        padding: 0 0.33in;
        text-transform: uppercase;
        z-index: 3;
      }
      .style-brand .page-ribbon {
        background: transparent;
        color: ${tokens.accent};
        min-height: 0.42in;
        padding-left: 0.58in;
      }
      .style-brand .page-ribbon::after {
        content: "";
        position: absolute;
        left: 0.58in;
        bottom: 0.02in;
        width: 0.72in;
        height: 1px;
        background: ${tokens.accent};
      }
      .style-brand:not(.cover) .page-ribbon {
        display: none;
      }
      .style-brand .section-label {
        display: inline-block;
        position: relative;
        padding-bottom: 0.07in;
      }
      .style-brand .section-label::after {
        content: "";
        position: absolute;
        left: 0;
        bottom: 0;
        width: 0.72in;
        height: 1px;
        background: ${tokens.accent};
      }
      .style-rise .page-ribbon,
      .style-rebuild .page-ribbon,
      .style-meetatheal .page-ribbon {
        background: transparent;
        color: ${tokens.accent};
        min-height: 0.42in;
        padding-left: 0.58in;
      }
      .style-rise .page-ribbon::after,
      .style-rebuild .page-ribbon::after,
      .style-meetatheal .page-ribbon::after {
        content: "";
        position: absolute;
        left: 0.58in;
        bottom: 0.02in;
        width: 0.72in;
        height: 1px;
        background: ${tokens.accent};
      }
      .style-rise:not(.cover) .page-ribbon,
      .style-rebuild:not(.cover) .page-ribbon,
      .style-meetatheal:not(.cover) .page-ribbon {
        display: none;
      }
      .style-land .page-ribbon {
        background: ${tokens.plum};
        color: ${tokens.paper};
      }
      .style-land:not(.cover) .section-label {
        display: none;
      }
      .section-label {
        color: ${tokens.accent};
        font-size: 9.6px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 14px;
      }
      h1, h2, h3 {
        font-family: "Cormorant Garamond", "Lora", Georgia, serif;
        font-weight: 700;
        color: ${tokens.ink};
        margin: 0;
      }
      h1 { font-size: 52px; line-height: 0.94; letter-spacing: 0; }
      h2 { font-size: 33px; line-height: 1; letter-spacing: 0; max-width: 6.35in; }
      h3 { font-size: 23px; line-height: 1.08; }
      p {
        color: ${tokens.mutedInk};
        font-size: 12px;
        line-height: 1.62;
        margin: 0 0 11px;
      }
      ul { margin: 12px 0 0 18px; padding: 0; color: ${tokens.mutedInk}; font-size: 12px; line-height: 1.55; }
      li { margin-bottom: 7px; }
      .content { margin-top: 22px; max-width: 6.48in; }
      .subtitle {
        color: ${tokens.mutedInk};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 18px;
        font-style: italic;
        line-height: 1.2;
        margin-top: 10px;
      }
      .check-list {
        display: grid;
        gap: 8px;
        margin: 12px 0 0;
        padding: 0;
        list-style: none;
      }
      .check-list li,
      .soft-check {
        display: grid;
        grid-template-columns: 17px 1fr;
        gap: 8px;
        color: ${tokens.mutedInk};
        font-size: 11.5px;
        line-height: 1.44;
      }
      .check-list li::before,
      .soft-check::before {
        content: "";
        width: 9px;
        height: 9px;
        margin-top: 4px;
        border-radius: 999px;
        background: ${tokens.accent};
      }
      .style-brand .check-list li::before,
      .style-brand .soft-check::before {
        border-radius: 0;
        transform: rotate(45deg);
      }
      .quote-box {
        position: relative;
        border-left: 4px solid ${tokens.plum};
        border-radius: 8px;
        background: ${tokens.accentSoft};
        margin: 16px 0;
        padding: 20px 22px 18px 42px;
      }
      .quote-mark {
        position: absolute;
        left: 13px;
        top: -4px;
        color: ${transparent(tokens.plum, 0.22)};
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
        color: ${tokens.accent};
        font-size: 9px;
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
        background: ${tokens.accent};
      }
      .key-term-box,
      .reflect-box,
      .alert-box {
        border-radius: 8px;
        margin: 14px 0;
        padding: 17px 19px;
      }
      .key-term-box {
        border-left: 4px solid ${tokens.plum};
        background: ${tokens.accentSoft};
      }
      .key-term-label {
        color: ${tokens.plum};
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 0.25em;
        margin-bottom: 8px;
        text-transform: uppercase;
      }
      .key-term-title {
        color: ${tokens.ink};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 24px;
        font-weight: 700;
        line-height: 1;
        margin-bottom: 7px;
      }
      .alert-box {
        display: grid;
        grid-template-columns: 24px 1fr;
        gap: 12px;
        align-items: start;
        border-left: 4px solid ${tokens.accent};
        background: ${transparent(tokens.paperAlt, 0.9)};
      }
      .alert-icon {
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        background: ${tokens.accent};
        color: ${tokens.paper};
        font-size: 13px;
        font-weight: 700;
      }
      .alert-text {
        color: ${tokens.ink};
        font-size: 10.4px;
        line-height: 1.48;
        white-space: pre-line;
      }
      .reflect-box {
        border: 1px solid ${tokens.line};
        border-left: 4px solid ${tokens.accent};
        background: rgba(255,255,255,0.36);
      }
      .reflect-box .prompt-text {
        margin: 0;
      }
      .prompt-stack { display: grid; gap: 15px; margin-top: 22px; }
      .prompt-card {
        position: relative;
        min-height: 1.04in;
        border: 1px solid ${tokens.line};
        border-left: 4px solid ${tokens.accent};
        border-radius: 8px;
        background: rgba(255, 253, 248, 0.58);
        padding: 15px 17px 12px;
      }
      .fillable-text-target {
        position: absolute;
        left: 0.22in;
        right: 0.22in;
        top: 0.48in;
        bottom: 0.12in;
        pointer-events: none;
      }
      .prompt-card.lines-1 .fillable-text-target {
        top: 0.38in;
      }
      .prompt-card.lines-3 .fillable-text-target {
        top: 0.54in;
      }
      .style-rise .prompt-card {
        border-left: 0;
        border-color: ${transparent(tokens.accent, 0.52)};
        background:
          linear-gradient(110deg, ${transparent(tokens.rose, 0.08)}, transparent 48%),
          rgba(255, 253, 248, 0.68);
      }
      .style-rise .prompt-card::after {
        content: "";
        position: absolute;
        right: 0.18in;
        bottom: 0.12in;
        width: 0.1in;
        height: 0.1in;
        background: ${tokens.accent};
        transform: rotate(45deg);
        opacity: 0.65;
      }
      .style-land .prompt-card {
        border-left-width: 5px;
        border-radius: 4px;
        background:
          linear-gradient(135deg, transparent 0 72%, ${transparent(tokens.sage, 0.1)} 72% 100%),
          rgba(255,255,255,0.5);
      }
      .style-rebuild .prompt-card {
        border-left-color: ${tokens.blue};
        background:
          radial-gradient(ellipse at 96% 18%, ${transparent(tokens.blue, 0.12)}, transparent 46%),
          rgba(255,255,255,0.62);
      }
      .style-meetatheal .prompt-card {
        border-left: 0;
        border-top: 3px solid ${tokens.accent};
        background:
          linear-gradient(180deg, ${transparent(tokens.rose, 0.08)}, transparent 38%),
          rgba(255,255,255,0.62);
        box-shadow: 0 0.08in 0.18in ${transparent(tokens.background, 0.05)};
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
        margin-bottom: 12px;
      }
      .prompt-text::before {
        content: "";
        width: 7px;
        height: 7px;
        flex: 0 0 auto;
        margin-top: 7px;
        background: ${tokens.accent};
        transform: rotate(45deg);
      }
      .style-rise .prompt-text::before,
      .style-meetatheal .prompt-text::before {
        border-radius: 999px;
        transform: none;
      }
      .writing-lines { display: grid; gap: 14px; margin-top: 13px; }
      .writing-lines span { display: block; height: 1px; background: ${tokens.line}; }
      .check-row {
        display: grid;
        grid-template-columns: 18px 1fr;
        gap: 12px;
        align-items: start;
        padding: 9px 0;
        border-bottom: 1px solid ${tokens.line};
      }
      .style-land .check-row {
        grid-template-columns: 17px 1fr;
        padding: 8px 0;
      }
      .style-rise .check-row,
      .style-meetatheal .check-row {
        border-bottom-color: ${transparent(tokens.accent, 0.25)};
      }
      .check-row .prompt-text {
        display: block;
        font-family: "Poppins", Arial, sans-serif;
        font-size: 11.5px;
        font-style: normal;
        font-weight: 500;
        line-height: 1.42;
        margin: 0;
      }
      .check-row .prompt-text::before { display: none; }
      .check-box {
        width: 14px;
        height: 14px;
        border: 1.5px solid ${tokens.line};
        border-radius: 3px;
        margin-top: 1px;
      }
      .style-rise .check-box,
      .style-meetatheal .check-box {
        border-radius: 999px;
        border-color: ${transparent(tokens.accent, 0.58)};
      }
      .style-land .check-box {
        border-radius: 2px;
        border-color: ${transparent(tokens.plum, 0.55)};
      }
      .tracker-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 24px;
        font-size: 10.4px;
        color: ${tokens.mutedInk};
      }
      .tracker-table th {
        text-align: left;
        color: ${tokens.paper};
        font-size: 8px;
        text-transform: uppercase;
        letter-spacing: 0.13em;
        padding: 9px;
        border: 1px solid ${tokens.line};
        background: ${tokens.plum};
      }
      .style-rise .tracker-table th {
        background: ${tokens.accent};
      }
      .style-rebuild .tracker-table th {
        background: ${tokens.blue};
      }
      .style-meetatheal .tracker-table th {
        background: ${tokens.rose};
      }
      .style-meetatheal .tracker-table {
        box-shadow: 0 0.08in 0.18in ${transparent(tokens.background, 0.04)};
      }
      .style-meetatheal .tracker-table td {
        background: ${transparent(tokens.paper, 0.62)};
      }
      .tracker-table td {
        height: 38px;
        border: 1px solid ${tokens.line};
        background: rgba(255,255,255,0.45);
        padding: 8px;
      }
      .action-grid {
        display: grid;
        gap: 14px;
        margin-top: 23px;
      }
      .action-card {
        display: grid;
        grid-template-columns: 26px 1fr;
        gap: 12px;
        align-items: start;
      }
      .action-num {
        display: grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border-radius: 999px;
        background: ${tokens.plum};
        color: ${tokens.paper};
        font-size: 12px;
        font-weight: 700;
      }
      .style-land .action-num {
        border-radius: 3px;
      }
      .style-rise .action-num,
      .style-meetatheal .action-num {
        background: ${tokens.accent};
      }
      .notes-field {
        min-height: 6.42in;
        margin-top: 22px;
        background-image: repeating-linear-gradient(to bottom, transparent 0 0.34in, ${tokens.line} 0.35in 0.36in);
      }
      .style-rise .notes-field,
      .style-meetatheal .notes-field {
        background-image:
          radial-gradient(circle at 50% 100%, ${transparent(tokens.accent, 0.08)}, transparent 1.5in),
          repeating-linear-gradient(to bottom, transparent 0 0.34in, ${tokens.line} 0.35in 0.36in);
      }
      .style-rebuild .notes-field {
        background-image:
          radial-gradient(ellipse at 95% 16%, ${transparent(tokens.blue, 0.12)}, transparent 1.2in),
          repeating-linear-gradient(to bottom, transparent 0 0.34in, ${tokens.line} 0.35in 0.36in);
      }
      .story-box,
      .takeaway-box {
        border-radius: 8px;
        padding: 17px 19px;
        margin-top: 16px;
      }
      .story-box {
        border: 1px solid ${tokens.line};
        background: rgba(255,255,255,0.45);
      }
      .takeaway-box {
        background: ${tokens.accentSoft};
        color: ${tokens.ink};
        font-weight: 600;
      }
      .type-reflection .content,
      .type-progress-check .content,
      .type-resource .content {
        max-width: 6.18in;
        margin-top: 0.34in;
      }
      .type-reflection .reflect-box {
        min-height: 1.1in;
        background:
          linear-gradient(135deg, ${transparent(tokens.accentSoft, 0.34)}, transparent 68%),
          ${transparent(tokens.paper, 0.72)};
        box-shadow: 0 0.08in 0.2in ${transparent(tokens.ink, 0.055)};
      }
      .type-progress-check .content {
        border: 1px solid ${transparent(tokens.line, 0.72)};
        border-left: 0.06in solid ${tokens.accent};
        border-radius: 0.08in;
        padding: 0.26in 0.3in;
        background:
          linear-gradient(120deg, ${transparent(tokens.accentSoft, 0.3)}, transparent 64%),
          ${transparent(tokens.paper, 0.78)};
        box-shadow: 0 0.12in 0.28in ${transparent(tokens.ink, 0.06)};
      }
      .type-progress-check .check-list {
        gap: 0.13in;
      }
      .type-progress-check .quote-box {
        margin-top: 0.24in;
      }
      .type-resource .content {
        display: grid;
        gap: 0.14in;
      }
      .type-resource .content > p:first-child {
        max-width: 5.5in;
        color: ${tokens.ink};
        font-size: 12.4px;
      }
      .type-resource .key-term-box,
      .type-resource .alert-box {
        margin: 0;
        box-shadow: 0 0.1in 0.24in ${transparent(tokens.ink, 0.055)};
      }
      .image-slot {
        min-height: 1.28in;
        border-radius: 8px;
        margin-top: 18px;
        border: 1px dashed ${transparent(tokens.plum, 0.38)};
        background:
          linear-gradient(135deg, ${transparent(tokens.accentSoft, 0.78)}, ${transparent(tokens.paper, 0.52)}),
          radial-gradient(circle at 85% 20%, ${transparent(tokens.accent, 0.22)}, transparent 0.8in);
      }
      .bottom-note {
        position: absolute;
        left: 0.58in;
        right: 0.58in;
        bottom: 0.73in;
        color: ${tokens.mutedInk};
        border-top: 1px solid ${tokens.line};
        padding-top: 12px;
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 13px;
        font-style: italic;
        line-height: 1.28;
      }
      .footer {
        position: absolute;
        left: 0.58in;
        right: 0.58in;
        bottom: 0.34in;
        display: flex;
        justify-content: space-between;
        color: ${tokens.mutedInk};
        font-size: 8.6px;
        z-index: 4;
      }
      .cover {
        display: block;
        padding: 0.54in 0.62in 0.58in;
        text-align: center;
      }
      .cover::before {
        inset: 0.16in;
      }
      .cover-copy {
        position: relative;
        z-index: 3;
        display: flex;
        flex-direction: column;
        align-items: center;
        max-width: 5.75in;
        min-height: 7.05in;
        margin: 0 auto;
      }
      .cover-brandline {
        color: ${tokens.background};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.3em;
        line-height: 1;
        margin-bottom: 0.12in;
        text-transform: uppercase;
        text-shadow: 0 1px 0 ${transparent(tokens.paper, 0.72)};
      }
      .branch-cover-mark {
        color: ${tokens.accent};
        --mark-accent: ${tokens.gold};
        --mark-soft: ${transparent(tokens.accentSoft, 0.72)};
        display: block;
        width: 0.78in;
        height: 0.58in;
        margin: 0 auto 0.13in;
      }
      .branch-cover-mark svg {
        display: block;
        width: 100%;
        height: 100%;
        overflow: visible;
      }
      .brand-mark {
        color: ${tokens.accent};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: 0.04em;
        margin-bottom: 14px;
      }
      .cover-title {
        color: ${tokens.ink};
        font-size: 84px;
        letter-spacing: 0.16em;
        line-height: 0.84;
        max-width: 5.8in;
        margin: 0 auto;
        text-transform: uppercase;
      }
      .cover-title.is-long {
        font-size: 56px;
        letter-spacing: 0.045em;
        line-height: 0.92;
        max-width: 6.05in;
      }
      .cover-subtitle {
        color: ${tokens.background};
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.3em;
        margin-top: 0.14in;
        text-transform: uppercase;
      }
      .cover-kit-title {
        color: ${tokens.background};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 36px;
        font-weight: 700;
        line-height: 0.98;
        margin-top: 0.22in;
        max-width: 4.9in;
        text-transform: uppercase;
      }
      .cover-kit-title.is-long {
        font-size: 31px;
        max-width: 5.3in;
      }
      .cover-divider {
        align-items: center;
        color: ${tokens.accent};
        display: flex;
        gap: 0.08in;
        justify-content: center;
        margin: 0.16in auto 0;
      }
      .cover-divider::before,
      .cover-divider::after {
        content: "";
        display: block;
        height: 1px;
        width: 0.48in;
        background: currentColor;
      }
      .cover-divider span {
        display: block;
        width: 0.055in;
        height: 0.055in;
        background: currentColor;
        transform: rotate(45deg);
      }
      .cover-mini-mark { display: none; }
      .cover-product {
        border: 0;
        color: ${tokens.background};
        display: inline-block;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.28em;
        margin-top: 0.2in;
        padding: 0;
        text-transform: uppercase;
      }
      .cover-tagline {
        color: ${tokens.background};
        position: absolute;
        left: 0.72in;
        right: 0.72in;
        bottom: 0.42in;
        z-index: 3;
        font-size: 8.4px;
        font-weight: 700;
        letter-spacing: 0.28em;
        margin: 0;
        text-transform: uppercase;
        text-shadow: 0 1px 5px ${transparent(tokens.paper, 0.72)};
      }
      .cover .image-slot {
        position: absolute;
        left: 0.62in;
        right: 0.62in;
        bottom: 1.08in;
        min-height: 1.2in;
        border: 0;
        border-radius: 0.08in;
        opacity: 0.42;
        background:
          linear-gradient(135deg, ${transparent(tokens.accentSoft, 0.26)}, transparent 70%),
          radial-gradient(circle at 14% 80%, ${transparent(tokens.sage, 0.2)}, transparent 0.72in),
          radial-gradient(circle at 88% 42%, ${transparent(tokens.accent, 0.12)}, transparent 0.64in);
      }
      .style-brand.cover .cover-title {
        color: ${tokens.ink};
        font-size: 62px;
        letter-spacing: 0.02em;
      }
      .style-brand.cover .decor::before {
        top: -0.62in;
        bottom: auto;
        right: -0.72in;
        width: 2.3in;
        height: 2.3in;
        background: ${transparent(tokens.plum, 0.72)};
      }
      .style-brand.cover .decor::after {
        left: -0.48in;
        top: -0.34in;
        width: 2.2in;
        height: 2.2in;
        background: ${transparent(tokens.lilac, 0.68)};
      }
      .style-brand.motif-grounded-circles.cover .cover-title {
        color: ${tokens.ink};
      }
      .style-brand.cover {
        align-content: center;
        padding: 0.7in 0.74in 0.9in;
        ${
          brandCoverArt
            ? `background:
          linear-gradient(${transparent(tokens.paper, 0.04)}, ${transparent(tokens.paper, 0.04)}),
          url("${brandCoverArt}") center / cover no-repeat,
          ${tokens.paper};`
            : `background:
          radial-gradient(circle at -4% 0%, ${transparent(tokens.plum, 0.56)} 0 0.8in, transparent 0.82in),
          radial-gradient(circle at 19% 11%, ${transparent(tokens.lilac, 0.26)} 0 1.05in, transparent 1.07in),
          radial-gradient(circle at 82% 9%, ${transparent(tokens.lilac, 0.45)} 0 0.44in, transparent 0.46in),
          radial-gradient(circle at 98% 94%, ${transparent(tokens.plum, 0.42)} 0 0.72in, transparent 0.74in),
          linear-gradient(168deg, transparent 0 74%, ${transparent(tokens.paperAlt, 0.72)} 74.5% 100%),
          ${tokens.paper};`
        }
      }
      ${
        brandCoverArt
          ? `.style-brand.cover::before,
      .style-brand.cover::after,
      .style-brand.cover .dots,
      .style-brand.cover .swoop,
      .style-brand.cover .decor::before,
      .style-brand.cover .decor::after,
      .style-brand.cover .brand-arc,
      .style-brand.cover .brand-cup,
      .style-brand.cover .brand-card,
      .style-brand.cover .brand-laptop,
      .style-brand.cover .brand-plant {
        display: none !important;
      }`
          : ""
      }
      .style-brand.cover .brand-mark {
        color: ${tokens.ink};
        font-size: 22px;
        margin-bottom: 0.08in;
      }
      .style-brand.cover .cover-title {
        font-size: 88px;
        line-height: 0.84;
        max-width: 5.72in;
      }
      .style-brand.cover .cover-title.is-long {
        font-size: 72px;
        line-height: 0.86;
        max-width: 6.12in;
      }
      .style-brand.cover .cover-subtitle {
        color: ${tokens.ink};
        font-family: "Poppins", Arial, sans-serif;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.28em;
        margin-top: 0.18in;
      }
      .style-brand.cover .cover-divider {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 0.28in;
        margin-top: 0.1in;
      }
      .style-brand.cover .cover-divider span {
        display: block;
        width: 0.64in;
        height: 1px;
        background: ${tokens.accent};
      }
      .style-brand.cover .cover-product {
        margin-top: 0.08in;
      }
      .style-brand.cover .cover-tagline {
        margin-top: 0.48in;
      }
      .style-brand.cover .image-slot {
        display: none;
      }
      .style-brand.cover .dots {
        right: 0.64in;
        top: 0.4in;
      }
      .style-brand.cover .brand-arc {
        display: block;
        left: -0.38in;
        top: -0.12in;
      }
      .style-brand.cover .brand-cup {
        display: block;
        left: 0.46in;
        bottom: 0.84in;
        transform: scale(1.18);
      }
      .style-brand.cover .brand-card {
        display: block;
        left: 3.24in;
        bottom: 0.82in;
        transform: rotate(-7deg) scale(1.08);
      }
      .style-brand.cover .brand-laptop {
        display: block;
        right: 0.34in;
        bottom: 0.72in;
        transform: rotate(2deg) scale(1.1);
      }
      .style-brand.cover .brand-plant {
        display: block;
        right: 1.36in;
        bottom: 1.34in;
        transform: scale(0.82);
        opacity: 0.82;
      }
      .style-brand.type-welcome .brand-plant,
      .style-brand.type-welcome .brand-card,
      .style-brand.type-welcome .brand-light,
      .style-brand.type-welcome .brand-arc {
        display: block;
      }
      .style-brand.type-welcome .brand-plant {
        right: 0.84in;
        top: 4.52in;
        transform: scale(1.02);
      }
      .style-brand.type-welcome .brand-card {
        right: 1.22in;
        top: 5.78in;
        transform: rotate(6deg) scale(0.78);
      }
      .style-brand.type-welcome .brand-light {
        right: 1.32in;
        top: 0;
      }
      .style-brand.type-welcome .brand-arc {
        right: -0.3in;
        top: 3.9in;
        left: auto;
        width: 2.25in;
        height: 2.25in;
        opacity: 0.42;
      }
      .style-brand.type-welcome .content {
        max-width: 5.05in;
        margin-top: 0.34in;
        border: 1px solid ${transparent(tokens.line, 0.62)};
        border-left: 0.06in solid ${tokens.accent};
        border-radius: 0.08in;
        padding: 0.26in 0.3in 0.28in;
        background:
          linear-gradient(90deg, ${transparent(tokens.paperAlt, 0.38)}, transparent 76%),
          ${transparent(tokens.paper, 0.86)};
        box-shadow: 0 0.12in 0.34in ${transparent(tokens.ink, 0.09)};
      }
      .style-brand.type-welcome .check-list {
        gap: 0.14in;
        max-width: 4.48in;
        margin-top: 0.2in;
      }
      .style-brand.type-welcome .check-list li {
        border-bottom: 1px solid ${transparent(tokens.line, 0.62)};
        color: ${tokens.ink};
        font-size: 12.2px;
        font-weight: 500;
        padding-bottom: 0.08in;
      }
      .style-brand.type-toc .page-ribbon,
      .style-brand.type-quote .page-ribbon,
      .style-brand.type-section-divider .page-ribbon {
        display: none;
      }
      .style-brand.type-section-divider .section-divider-page {
        min-height: 8.72in;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 1.16in 0.58in 0.48in;
        text-align: center;
      }
      .style-brand.type-how-to-use .content {
        max-width: 6.18in;
        margin-top: 0.44in;
      }
      .style-brand.type-how-to-use .alert-box {
        min-height: 1.48in;
        border-left-width: 0.06in;
        border-radius: 0.08in;
        padding: 0.24in 0.3in;
        background:
          linear-gradient(135deg, ${transparent(tokens.paperAlt, 0.48)}, transparent 64%),
          ${transparent(tokens.paper, 0.88)};
        box-shadow: 0 0.12in 0.32in ${transparent(tokens.ink, 0.08)};
      }
      .style-brand.type-how-to-use .alert-icon {
        margin-top: 0.02in;
      }
      .style-brand.type-how-to-use .alert-text {
        font-size: 11.4px;
        line-height: 1.58;
      }
      .style-brand.type-toc h2 {
        text-align: center;
        max-width: none;
        margin-top: 0.48in;
        font-size: 48px;
      }
      .style-brand.type-toc .content {
        max-width: 6.05in;
        margin: 0.64in auto 0;
        padding: 0.22in 0.34in 0.28in;
        border: 1px solid ${transparent(tokens.line, 0.62)};
        border-radius: 0.08in;
        background: ${transparent(tokens.paper, 0.88)};
        box-shadow: 0 0.12in 0.34in ${transparent(tokens.ink, 0.075)};
      }
      .style-brand.type-toc .tracker-table {
        border-collapse: separate;
        border-spacing: 0;
        font-family: "Poppins", Arial, sans-serif;
      }
      .style-brand.type-toc .tracker-table td {
        height: 0.42in;
        border: 0;
        border-bottom: 1px dotted ${transparent(tokens.mutedInk, 0.48)};
        background: transparent !important;
        padding: 0.1in 0;
        font-size: 11.2px;
      }
      .style-brand.type-toc .tracker-table td:first-child {
        width: 0.44in;
        color: ${tokens.ink};
        font-weight: 700;
      }
      .style-brand.type-toc .tracker-table td:last-child {
        width: 0.44in;
        text-align: right;
        color: ${tokens.ink};
      }
      .style-brand.type-toc .brand-book {
        display: block;
        right: 0.68in;
        bottom: 0.96in;
        transform: rotate(6deg) scale(1.12);
      }
      .style-brand.type-toc .brand-plant {
        display: block;
        left: 0.62in;
        bottom: 0.92in;
        transform: scale(0.9);
      }
      .style-brand.type-toc .brand-pen {
        display: block;
        right: 1.38in;
        bottom: 1.48in;
        transform: rotate(-19deg) scale(0.94);
      }
      .style-brand.type-quote .brand-laptop {
        display: block;
        right: -0.34in;
        top: 0.28in;
        transform: rotate(4deg) scale(1.34);
      }
      .style-brand.type-quote .brand-cup {
        display: block;
        right: 0.5in;
        top: 4.48in;
        transform: scale(1.28);
      }
      .style-brand.type-quote .brand-book {
        display: block;
        right: -0.08in;
        bottom: 0.42in;
        transform: rotate(-11deg) scale(1.28);
      }
      .style-brand.type-quote .brand-pen {
        display: block;
        right: 0.3in;
        bottom: 1.08in;
        transform: rotate(-24deg) scale(0.9);
      }
      .style-brand.type-quote .brand-arc {
        display: block;
        left: -0.58in;
        top: 1.3in;
        opacity: 0.68;
        transform: scale(1.08);
      }
      .style-brand.type-quote .decor::before {
        background: ${transparent(tokens.plum, 0.34)};
        left: -0.54in;
        top: -0.52in;
        width: 1.92in;
        height: 1.92in;
      }
      .style-brand.type-quote .decor::after {
        background: ${transparent(tokens.lilac, 0.36)};
        left: -0.72in;
        bottom: -0.12in;
        width: 1.9in;
        height: 1.9in;
      }
      .style-brand.type-quote .quote-page {
        min-height: 8.72in;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 2.04in 1.12in 0.52in;
      }
      .style-brand.type-quote .quote-page .quote-box {
        border-left: 0;
        border-radius: 0;
        background: transparent;
        max-width: 4.18in;
        padding: 0;
        text-align: center;
        box-shadow: none;
      }
      .style-brand.type-quote .quote-page .quote-text {
        color: ${tokens.ink};
        font-size: 43px;
        line-height: 1.04;
        font-style: normal;
        font-weight: 600;
      }
      .style-brand.type-quote .quote-page .quote-mark {
        color: ${tokens.plum};
        display: block;
        font-size: 86px;
        line-height: 0.68;
        margin: 0 auto 0.2in;
        position: relative;
      }
      .style-brand.type-quote .quote-page .quote-mark::after {
        content: "";
        display: block;
        width: 1.02in;
        height: 1px;
        margin: 0.18in auto 0;
        background: ${tokens.accent};
        box-shadow:
          0.47in 0 0 ${tokens.accent},
          0.235in 0 0 0.035in ${tokens.accent};
      }
      .style-brand.type-quote .quote-page .quote-by {
        display: inline-block;
        color: ${tokens.background};
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.38em;
        margin-top: 0.5in;
        padding-top: 0.42in;
        position: relative;
      }
      .style-brand.type-quote .quote-page .quote-by::before {
        content: "B C";
        background: transparent;
        color: ${tokens.ink};
        display: block;
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 34px;
        font-weight: 700;
        height: auto;
        left: 50%;
        line-height: 1;
        position: absolute;
        top: -0.02in;
        transform: translateX(-50%);
        width: auto;
      }
      .style-brand.type-quote .quote-page .quote-by::after {
        content: "";
        display: block;
        width: 0.78in;
        height: 1px;
        margin: 0.16in auto 0;
        background: ${tokens.accent};
      }
      .style-brand.type-section-divider .section-divider-box {
        position: relative;
        width: 5.88in;
        min-height: 3.58in;
        border: 0;
        border-radius: 0;
        background: transparent;
        color: ${tokens.ink};
        overflow: hidden;
        padding: 0.44in 0.36in 0.34in;
        box-shadow: none;
      }
      .style-brand.type-section-divider .section-divider-box::before {
        content: "";
        position: absolute;
        left: 0.64in;
        right: 0.44in;
        top: 0.1in;
        height: 1.3in;
        border: 0.2in solid ${transparent(tokens.lilac, 0.16)};
        border-bottom: 0;
        border-radius: 50% 50% 0 0;
      }
      .style-brand.type-section-divider .section-divider-box > * {
        position: relative;
        z-index: 2;
      }
      .style-brand.type-section-divider .image-slot {
        display: none;
      }
      .style-brand.type-section-divider .section-label {
        color: ${tokens.accent};
        font-family: "Poppins", Arial, sans-serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.36em;
        text-transform: uppercase;
      }
      .style-brand.type-section-divider .section-label::after {
        content: "";
        display: block;
        width: 1.08in;
        height: 1px;
        margin: 0.2in auto 0;
        background: ${tokens.accent};
        box-shadow:
          0.48in 0 0 ${tokens.accent},
          0.24in 0 0 0.035in ${tokens.accent};
      }
      .style-brand.type-section-divider .brand-mark {
        display: none;
      }
      .style-brand.type-section-divider h2 {
        color: ${tokens.ink};
        font-size: 46px;
        line-height: 0.98;
        max-width: 4.9in;
        margin: 0.42in auto 0;
        text-align: center;
        text-transform: uppercase;
      }
      .style-brand.type-section-divider .subtitle {
        color: ${tokens.background};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 18px;
        font-style: italic;
        line-height: 1.35;
        max-width: 3.35in;
        margin: 0.28in auto 0;
      }
      .style-brand.type-section-divider .brand-light,
      .style-brand.type-section-divider .brand-book,
      .style-brand.type-section-divider .brand-pen,
      .style-brand.type-section-divider .brand-plant,
      .style-brand.type-section-divider .brand-arc {
        display: block;
      }
      .style-brand.type-section-divider .brand-light {
        right: 0.66in;
        top: 0;
        opacity: 0.74;
        transform: scale(0.96);
      }
      .style-brand.type-section-divider .brand-book {
        right: 0.76in;
        bottom: 0.7in;
        transform: rotate(-5deg) scale(1.2);
      }
      .style-brand.type-section-divider .brand-pen {
        right: 1.44in;
        bottom: 1.22in;
        transform: rotate(-21deg) scale(0.88);
      }
      .style-brand.type-section-divider .brand-plant {
        left: 0.66in;
        bottom: 0.88in;
        opacity: 0.82;
        transform: scale(0.82);
      }
      .style-brand.type-section-divider .brand-arc {
        right: -0.68in;
        bottom: -0.48in;
        width: 2.82in;
        height: 2.82in;
        opacity: 0.62;
      }
      .style-brand.type-section-divider .decor::before {
        background: ${transparent(tokens.plum, 0.82)};
        left: -0.54in;
        top: -0.62in;
        width: 2.02in;
        height: 2.02in;
      }
      .style-brand.type-section-divider .decor::after {
        background: ${transparent(tokens.lilac, 0.5)};
        left: 0.68in;
        top: -0.52in;
        width: 1.82in;
        height: 1.82in;
      }
      .style-brand.type-lesson-continue .content {
        max-width: 5.08in;
        margin-top: 0.28in;
        padding: 0.22in 0.26in;
        border-radius: 0.08in;
        background: ${transparent(tokens.paper, 0.72)};
        box-shadow: 0 0.1in 0.26in ${transparent(tokens.ink, 0.052)};
      }
      .style-brand.type-lesson {
        padding: 0.68in 0.62in 0.64in;
      }
      .style-brand.type-lesson .lesson-content-page {
        min-height: 9.55in;
        display: grid;
        grid-template-columns: 2.24in 1fr;
        grid-template-rows: 1fr auto;
        column-gap: 0.42in;
        row-gap: 0.24in;
      }
      .style-brand.type-lesson .lesson-sidebar {
        min-height: 7.15in;
        border-left: 0.06in solid ${tokens.accent};
        border-radius: 0.08in;
        padding: 0.28in 0.2in 0.24in 0.28in;
        background:
          linear-gradient(135deg, ${transparent(tokens.lilac, 0.2)}, transparent 58%),
          ${transparent(tokens.paper, 0.88)};
        box-shadow: 0 0.12in 0.28in ${transparent(tokens.ink, 0.07)};
      }
      .style-brand.type-lesson .lesson-kicker {
        color: ${tokens.accent};
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.32em;
        line-height: 1;
        text-transform: uppercase;
      }
      .style-brand.type-lesson .lesson-title {
        color: ${tokens.ink};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 38px;
        font-weight: 700;
        line-height: 0.96;
        margin: 0.24in 0 0;
      }
      .style-brand.type-lesson .lesson-intro {
        color: ${tokens.background};
        font-size: 11.4px;
        font-weight: 500;
        line-height: 1.62;
        margin-top: 0.26in;
      }
      .style-brand.type-lesson .lesson-sidebar-list-label {
        color: ${tokens.accent};
        font-size: 8.8px;
        font-weight: 800;
        letter-spacing: 0.22em;
        margin-top: 0.32in;
        text-transform: uppercase;
      }
      .style-brand.type-lesson .lesson-sidebar-list {
        display: grid;
        gap: 0.11in;
        list-style: none;
        margin: 0.14in 0 0;
        padding: 0;
      }
      .style-brand.type-lesson .lesson-sidebar-list li {
        color: ${tokens.background};
        font-size: 9.6px;
        font-weight: 600;
        line-height: 1.35;
        padding-left: 0.18in;
        position: relative;
      }
      .style-brand.type-lesson .lesson-sidebar-list li::before {
        background: ${tokens.accent};
        border-radius: 999px;
        content: "";
        height: 0.055in;
        left: 0;
        position: absolute;
        top: 0.06in;
        width: 0.055in;
      }
      .style-brand.type-lesson .lesson-sidebar-mark {
        color: ${tokens.accent};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: 0.08em;
        margin-top: 0.42in;
      }
      .style-brand.type-lesson .lesson-main {
        align-self: start;
        padding-top: 0.08in;
      }
      .style-brand.type-lesson .lesson-section {
        display: grid;
        grid-template-columns: 0.42in 1fr;
        column-gap: 0.18in;
        padding: 0.04in 0 0.26in;
      }
      .style-brand.type-lesson .lesson-section + .lesson-section {
        border-top: 1px solid ${transparent(tokens.line, 0.72)};
        padding-top: 0.28in;
      }
      .style-brand.type-lesson .lesson-number {
        align-items: center;
        background: ${tokens.ink};
        border: 1px solid ${transparent(tokens.accent, 0.72)};
        border-radius: 999px;
        color: ${tokens.paper};
        display: flex;
        font-size: 12px;
        font-weight: 800;
        height: 0.34in;
        justify-content: center;
        letter-spacing: 0.04em;
        margin-top: 0.02in;
        width: 0.34in;
      }
      .style-brand.type-lesson .lesson-section-title {
        color: ${tokens.ink};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 24px;
        font-weight: 700;
        line-height: 1.05;
      }
      .style-brand.type-lesson .lesson-section-body {
        color: ${tokens.background};
        font-size: 10.8px;
        font-weight: 500;
        line-height: 1.56;
        margin-top: 0.09in;
      }
      .style-brand.type-lesson .lesson-takeaway-box {
        grid-column: 1 / -1;
        border-left: 0.06in solid ${tokens.accent};
        border-radius: 0.08in;
        background:
          linear-gradient(90deg, ${transparent(tokens.lilac, 0.16)}, transparent 72%),
          ${transparent(tokens.paperAlt, 0.78)};
        padding: 0.22in 0.3in 0.24in;
        box-shadow: 0 0.12in 0.3in ${transparent(tokens.ink, 0.08)};
      }
      .style-brand.type-lesson .lesson-takeaway-label {
        color: ${tokens.accent};
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.3em;
        text-transform: uppercase;
      }
      .style-brand.type-lesson .lesson-takeaway-text {
        color: ${tokens.ink};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 20px;
        font-style: italic;
        line-height: 1.28;
        margin-top: 0.08in;
      }
      .style-brand.type-lesson .lesson-footer-mark {
        bottom: 0.32in;
        color: ${tokens.ink};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 24px;
        font-weight: 700;
        left: 50%;
        letter-spacing: 0.08em;
        position: absolute;
        transform: translateX(-50%);
        z-index: 3;
      }
      .style-brand.type-lesson .lesson-footer-mark span {
        color: ${tokens.accent};
      }
      .style-brand.type-lesson .lesson-page-number {
        bottom: 0.34in;
        color: ${tokens.mutedInk};
        font-size: 9px;
        font-weight: 700;
        position: absolute;
        right: 0.72in;
        z-index: 3;
      }
      .style-brand.type-lesson .brand-door,
      .style-brand.type-lesson .brand-card,
      .style-brand.type-lesson .brand-plant,
      .style-brand.type-lesson .brand-arc {
        display: block;
      }
      .style-brand.type-lesson .brand-door {
        right: 0.56in;
        top: 1.78in;
        opacity: 0.2;
        transform: scale(0.88);
      }
      .style-brand.type-lesson .brand-card {
        right: 0.58in;
        bottom: 1.18in;
        opacity: 0.82;
        transform: rotate(-7deg) scale(0.8);
      }
      .style-brand.type-lesson .brand-plant {
        left: 1.08in;
        bottom: 1.3in;
        opacity: 0.64;
        transform: scale(0.72);
      }
      .style-brand.type-lesson .brand-arc {
        left: -0.78in;
        bottom: -0.38in;
        width: 2.68in;
        height: 2.68in;
        opacity: 0.54;
      }
      .style-brand.type-lesson-continue .reflect-box {
        max-width: 4.92in;
        min-height: 1.32in;
        border-left-width: 0.05in;
        border-radius: 0.08in;
        background: ${transparent(tokens.paper, 0.86)};
        box-shadow: 0 0.1in 0.24in ${transparent(tokens.ink, 0.055)};
      }
      .style-brand.type-lesson-continue .brand-cup {
        display: block;
        right: 0.92in;
        bottom: 1.08in;
        transform: scale(0.82);
      }
      .style-brand.type-lesson-continue .brand-card {
        display: block;
        right: 0.76in;
        top: 2.3in;
        transform: rotate(6deg) scale(0.88);
      }
      .style-brand.type-lesson-continue .brand-light {
        display: block;
        right: 0.86in;
        top: 0;
        transform: scale(0.94);
      }
      .style-brand.type-workbook .content,
      .style-brand.type-checklist .content,
      .style-brand.type-action-plan .content,
      .style-brand.type-notes .content {
        max-width: 6.65in;
      }
      .style-brand.type-workbook .content,
      .style-brand.type-checklist .content,
      .style-brand.type-action-plan .content,
      .style-brand.type-tracker .content,
      .style-brand.type-case-study .content {
        margin-top: 0.34in;
      }
      .style-brand.type-workbook .prompt-stack,
      .style-brand.type-action-plan .action-grid {
        gap: 0.2in;
      }
      .style-brand.type-workbook .prompt-card {
        min-height: 1.48in;
        border-left-width: 0.06in;
        border-radius: 0.08in;
        background:
          linear-gradient(135deg, ${transparent(tokens.paperAlt, 0.22)}, transparent 72%),
          ${transparent(tokens.paper, 0.9)};
        box-shadow: 0 0.12in 0.3in ${transparent(tokens.ink, 0.08)};
        padding: 0.2in 0.24in 0.17in;
      }
      .style-brand.type-workbook .prompt-text {
        font-size: 20.5px;
        line-height: 1.05;
      }
      .style-brand.type-workbook .fillable-text-target {
        top: 0.64in;
      }
      .style-brand.type-workbook .writing-lines {
        gap: 0.13in;
      }
      .style-brand.type-workbook .brand-pen,
      .style-brand.type-workbook .brand-card {
        display: block;
      }
      .style-brand.type-workbook .brand-pen {
        right: 0.86in;
        bottom: 1.55in;
        transform: rotate(-17deg) scale(1.04);
      }
      .style-brand.type-workbook .brand-card {
        right: 1.38in;
        bottom: 0.96in;
        transform: rotate(7deg) scale(0.98);
      }
      .style-brand.type-checklist .prompt-stack,
      .style-brand.type-tracker .tracker-table,
      .style-brand.type-action-plan .action-grid {
        max-width: 6.42in;
      }
      .style-brand.type-checklist .prompt-stack {
        border: 1px solid ${transparent(tokens.line, 0.78)};
        border-left: 0.05in solid ${tokens.accent};
        border-radius: 0.08in;
        background: ${transparent(tokens.paper, 0.88)};
        box-shadow: 0 0.12in 0.3in ${transparent(tokens.ink, 0.075)};
        padding: 0.18in 0.26in 0.16in;
      }
      .style-brand.type-checklist .check-row {
        min-height: 0.36in;
        padding: 0.09in 0.02in;
      }
      .style-brand.type-checklist .check-box {
        width: 0.16in;
        height: 0.16in;
        border-color: ${transparent(tokens.plum, 0.46)};
      }
      .style-brand.type-checklist .check-row .prompt-text {
        color: ${tokens.ink};
        font-size: 12px;
      }
      .style-brand.type-checklist .prompt-card .fillable-text-target {
        top: 0.44in;
      }
      .style-brand.type-checklist .brand-book,
      .style-brand.type-checklist .brand-pen,
      .style-brand.type-checklist .brand-plant {
        display: block;
      }
      .style-brand.type-checklist .brand-book {
        right: 0.74in;
        bottom: 1in;
        transform: rotate(8deg) scale(1.06);
      }
      .style-brand.type-checklist .brand-pen {
        right: 1.2in;
        bottom: 1.58in;
        transform: rotate(-18deg) scale(0.96);
      }
      .style-brand.type-checklist .brand-plant {
        right: 0.48in;
        bottom: 1.12in;
        transform: scale(0.9);
        opacity: 0.86;
      }
      .style-brand.type-tracker .tracker-table {
        border-collapse: separate;
        border-spacing: 0;
        border-radius: 0.06in;
        overflow: hidden;
        background: ${transparent(tokens.paper, 0.86)};
        box-shadow: 0 0.12in 0.3in ${transparent(tokens.ink, 0.08)};
      }
      .style-brand.type-tracker .tracker-table th {
        background: ${tokens.plum};
        border-color: ${transparent(tokens.plum, 0.34)};
        font-size: 8.4px;
        padding: 0.11in;
      }
      .style-brand.type-tracker .tracker-table td {
        height: 0.43in;
        background: ${transparent(tokens.paper, 0.78)};
      }
      .style-brand.type-tracker .tracker-table td:first-child {
        color: ${tokens.ink};
        font-weight: 600;
      }
      .style-brand.type-tracker .prompt-card {
        max-width: 6.42in;
        border-radius: 0.08in;
        background: ${transparent(tokens.paper, 0.88)};
        box-shadow: 0 0.1in 0.24in ${transparent(tokens.ink, 0.055)};
      }
      .style-brand.type-tracker .brand-plant {
        display: block;
        right: 0.52in;
        bottom: 1.02in;
        transform: scale(0.8);
      }
      .style-brand.type-action-plan .brand-card {
        display: block;
        right: 0.64in;
        bottom: 0.92in;
        transform: rotate(7deg) scale(1.05);
      }
      .style-brand.type-action-plan .brand-cup {
        display: block;
        left: 0.66in;
        bottom: 1.08in;
        transform: scale(0.84);
      }
      .style-brand.type-action-plan .brand-laptop {
        display: block;
        left: 0.46in;
        bottom: 0.92in;
        transform: rotate(-3deg) scale(0.94);
        opacity: 0.88;
      }
      .style-brand.type-action-plan .prompt-card {
        border-left-color: ${tokens.accent};
        border-radius: 0.08in;
        background: ${transparent(tokens.paper, 0.9)};
        box-shadow: 0 0.1in 0.24in ${transparent(tokens.ink, 0.065)};
      }
      .style-brand.type-action-plan .action-num {
        background: ${tokens.plum};
        width: 0.3in;
        height: 0.3in;
        box-shadow: 0 0.04in 0.1in ${transparent(tokens.ink, 0.12)};
      }
      .style-brand.type-notes .brand-cup,
      .style-brand.type-notes .brand-card,
      .style-brand.type-notes .brand-plant {
        display: block;
      }
      .style-brand.type-notes .brand-cup {
        right: 0.64in;
        bottom: 0.92in;
        transform: scale(0.86);
      }
      .style-brand.type-notes .brand-card {
        left: 0.58in;
        bottom: 0.92in;
        transform: rotate(-5deg) scale(0.96);
      }
      .style-brand.type-notes .brand-plant {
        right: 1.18in;
        top: 1.95in;
        transform: scale(0.86);
        opacity: 0.86;
      }
      .style-brand.type-notes .notes-field {
        min-height: 6.72in;
        margin-top: 0.34in;
        border: 1px solid ${transparent(tokens.line, 0.62)};
        border-left: 0.06in solid ${transparent(tokens.accent, 0.92)};
        border-radius: 0.08in;
        padding: 0.18in 0.22in;
        background-color: ${transparent(tokens.paper, 0.72)};
        background-image:
          linear-gradient(90deg, ${transparent(tokens.paperAlt, 0.16)}, transparent 42%),
          repeating-linear-gradient(to bottom, transparent 0 0.34in, ${transparent(tokens.line, 0.86)} 0.35in 0.36in);
        box-shadow: 0 0.12in 0.28in ${transparent(tokens.ink, 0.06)};
      }
      .style-brand.type-case-study .story-box {
        background:
          linear-gradient(115deg, ${transparent(tokens.accentSoft, 0.76)}, transparent 62%),
          ${transparent(tokens.paper, 0.88)};
        border-left: 0.05in solid ${tokens.accent};
        border-radius: 0.08in;
        min-height: 1.08in;
        box-shadow: 0 0.12in 0.3in ${transparent(tokens.ink, 0.07)};
      }
      .style-brand.type-case-study .takeaway-box {
        background: ${tokens.plum};
        color: ${tokens.paper};
        border-radius: 0.06in;
        letter-spacing: 0.04em;
        box-shadow: 0 0.1in 0.24in ${transparent(tokens.ink, 0.07)};
      }
      .style-brand.type-case-study .brand-card {
        display: block;
        right: 0.7in;
        bottom: 0.92in;
        transform: rotate(7deg) scale(1.06);
      }
      .style-brand.type-case-study .brand-pen,
      .style-brand.type-case-study .brand-glasses {
        display: block;
      }
      .style-brand.type-case-study .brand-pen {
        left: 0.68in;
        bottom: 1.06in;
        transform: rotate(-16deg) scale(1);
      }
      .style-brand.type-case-study .brand-glasses {
        left: 1.08in;
        bottom: 1.62in;
        transform: rotate(-5deg) scale(1.08);
      }
      .style-brand.type-reflection .brand-cup,
      .style-brand.type-reflection .brand-light,
      .style-brand.type-progress-check .brand-card,
      .style-brand.type-progress-check .brand-plant,
      .style-brand.type-resource .brand-book,
      .style-brand.type-resource .brand-pen,
      .style-brand.type-resource .brand-light {
        display: block;
      }
      .style-brand.type-reflection .brand-cup {
        right: 0.84in;
        bottom: 1.02in;
        transform: scale(0.78);
      }
      .style-brand.type-reflection .brand-light {
        right: 1.02in;
        top: 0;
        transform: scale(0.88);
      }
      .style-brand.type-progress-check .brand-card {
        right: 0.76in;
        bottom: 1.02in;
        transform: rotate(6deg) scale(0.86);
      }
      .style-brand.type-progress-check .brand-plant {
        right: 1.18in;
        bottom: 1.56in;
        transform: scale(0.72);
      }
      .style-brand.type-resource .brand-book {
        right: 0.74in;
        bottom: 1.04in;
        transform: rotate(5deg) scale(0.96);
      }
      .style-brand.type-resource .brand-pen {
        right: 1.2in;
        bottom: 1.52in;
        transform: rotate(-18deg) scale(0.82);
      }
      .style-brand.type-resource .brand-light {
        right: 0.86in;
        top: 0;
        transform: scale(0.88);
      }
      .style-brand.type-closing {
        text-align: center;
        padding: 0.72in 0.74in 0.86in;
        background:
          radial-gradient(circle at -4% 2%, ${transparent(tokens.plum, 0.42)} 0 0.88in, transparent 0.9in),
          radial-gradient(circle at 96% 6%, ${transparent(tokens.plum, 0.28)} 0 0.72in, transparent 0.74in),
          radial-gradient(circle at 14% 88%, ${transparent(tokens.lilac, 0.28)} 0 1.28in, transparent 1.3in),
          radial-gradient(ellipse at 88% 88%, ${transparent(tokens.accent, 0.1)}, transparent 1.55in),
          linear-gradient(126deg, transparent 0 68%, ${transparent(tokens.lilac, 0.14)} 68.5% 100%),
          ${tokens.paper};
      }
      .style-brand.type-closing .closing-panel {
        min-height: 8.5in;
        display: grid;
        place-items: center;
        position: relative;
      }
      .style-brand.type-closing .image-slot {
        display: none;
      }
      .style-brand.type-closing .brand-mark {
        color: ${tokens.ink};
        font-size: 22px;
        margin-bottom: 0.18in;
      }
      .style-brand.type-closing h1 {
        color: ${tokens.ink};
        font-size: 50px;
        line-height: 0.94;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }
      .style-brand.type-closing .subtitle {
        color: ${tokens.ink};
        font-family: "Poppins", Arial, sans-serif;
        font-size: 10px;
        font-style: normal;
        font-weight: 700;
        letter-spacing: 0.34em;
        line-height: 1.45;
        margin: 0.18in auto 0;
        max-width: 4.2in;
        text-transform: uppercase;
      }
      .style-brand.type-closing .cover-tagline {
        color: ${tokens.mutedInk};
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.28em;
        margin-top: 0.42in;
        text-transform: uppercase;
      }
      .style-brand.type-closing .brand-laptop,
      .style-brand.type-closing .brand-book,
      .style-brand.type-closing .brand-plant,
      .style-brand.type-closing .brand-cup {
        display: block;
      }
      .style-brand.type-closing .brand-laptop {
        left: 0.52in;
        bottom: 0.76in;
        transform: rotate(-3deg) scale(1.12);
      }
      .style-brand.type-closing .brand-book {
        right: 0.58in;
        bottom: 0.88in;
        transform: rotate(5deg) scale(1.22);
      }
      .style-brand.type-closing .brand-plant {
        right: 0.96in;
        bottom: 1.58in;
        transform: scale(1.04);
      }
      .style-brand.type-closing .brand-cup {
        left: 2.04in;
        bottom: 0.78in;
        transform: scale(0.88);
      }
      .style-rise.cover {
        align-content: start;
        padding: 0.7in 0.62in 0.56in;
        text-align: center;
        background:
          radial-gradient(ellipse at 10% 14%, ${transparent(tokens.rose, 0.2)}, transparent 38%),
          radial-gradient(ellipse at 88% 72%, ${transparent(tokens.accent, 0.14)}, transparent 34%),
          linear-gradient(118deg, ${transparent(tokens.rose, 0.26)} 0 13%, transparent 35%),
          linear-gradient(70deg, transparent 0 56%, ${transparent(tokens.accent, 0.22)} 82%, transparent 100%),
          linear-gradient(108deg, transparent 0 68%, ${transparent(tokens.lilac, 0.2)} 68.5% 82%, transparent 82.5%),
          ${tokens.paper};
      }
      .style-rise.cover .cover-copy {
        margin: 0 auto;
        max-width: 5.5in;
        position: static;
      }
      .style-rise.cover .brand-mark {
        color: ${tokens.accent};
        font-size: 28px;
        line-height: 1;
        margin-bottom: 0.12in;
        text-shadow: 0 1px 0 ${tokens.paper};
      }
      .style-rise.cover .cover-brandline {
        color: ${tokens.background};
        font-size: 8.5px;
        font-weight: 800;
        letter-spacing: 0.34em;
        margin-bottom: 0;
      }
      .style-rise.cover .cover-divider {
        align-items: center;
        color: ${tokens.rose};
        display: flex;
        gap: 0.08in;
        justify-content: center;
        margin: 0.12in auto 0.13in;
      }
      .style-rise.cover .cover-divider::before,
      .style-rise.cover .cover-divider::after {
        content: "";
        display: block;
        height: 1px;
        width: 0.33in;
        background: currentColor;
      }
      .style-rise.cover .cover-divider span {
        color: currentColor;
        display: block;
        font-size: 9px;
        line-height: 1;
      }
      .style-rise.cover .cover-title {
        color: ${tokens.rose};
        font-size: 98px;
        letter-spacing: 0.18em;
        line-height: 0.82;
        text-shadow:
          0 1px 0 ${tokens.paper},
          0 3px 10px ${transparent(tokens.accent, 0.32)};
      }
      .style-rise.cover .cover-title.is-long {
        color: ${tokens.rose};
        font-size: 56px;
        line-height: 0.94;
        letter-spacing: 0.04em;
        max-width: 5.4in;
      }
      .style-rise.cover .cover-subtitle {
        color: ${tokens.background};
        font-size: 9.6px;
        font-weight: 700;
        letter-spacing: 0.34em;
        margin-top: 0.2in;
      }
      .style-rise.cover .cover-product {
        background: transparent;
        border: 0;
        box-shadow: none;
        color: ${tokens.background};
        font-size: 12.5px;
        font-weight: 600;
        letter-spacing: 0.3em;
        margin-top: 0.38in;
        padding: 0;
      }
      .style-rise.cover .cover-mini-mark {
        color: ${tokens.rose};
        display: block;
        font-size: 20px;
        line-height: 1;
        margin-top: 0.28in;
      }
      .style-rise.cover .cover-tagline {
        color: ${tokens.background};
        font-size: 8.4px;
        left: 0.72in;
        letter-spacing: 0.3em;
        margin: 0;
        position: absolute;
        right: 0.72in;
        bottom: 0.42in;
        z-index: 3;
        text-shadow: 0 1px 4px ${transparent(tokens.paper, 0.9)};
      }
      .style-rise .section-label {
        color: ${tokens.rose};
        font-size: 8.8px;
        letter-spacing: 0.32em;
      }
      .style-rise h2 {
        color: ${tokens.plum};
        font-size: 39px;
        letter-spacing: 0.02em;
        line-height: 0.98;
        text-transform: uppercase;
      }
      .style-rise .subtitle {
        color: ${tokens.rose};
        font-size: 22px;
        font-style: italic;
        font-weight: 600;
        letter-spacing: 0.01em;
        line-height: 1.05;
      }
      .style-rise.type-notes h2,
      .style-rise.type-closing .cover-tagline {
        color: ${tokens.rose};
        font-style: italic;
        text-transform: none;
      }
      .style-rise .quote-text {
        color: ${tokens.background};
        font-size: 25px;
        font-weight: 400;
        line-height: 1.22;
      }
      .style-rise .quote-mark {
        color: ${transparent(tokens.rose, 0.7)};
      }
      .style-rise .prompt-card .prompt-text {
        color: ${tokens.background};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 17px;
        font-style: italic;
        font-weight: 600;
      }
      .style-rise.cover .image-slot {
        display: none;
      }
      .style-rise.cover .rise-crown,
      .style-rise.cover .rise-glass,
      .style-rise.cover .rise-cake,
      .style-rise.cover .floral-left,
      .style-rise.cover .floral-right {
        display: block;
      }
      .style-rise.cover .rise-crown {
        left: 50%;
        bottom: 2.08in;
        transform: translateX(-50%);
      }
      .style-rise.cover .rise-glass {
        right: 0.94in;
        bottom: 0.92in;
        transform: rotate(-7deg) scale(1.16);
      }
      .style-rise.cover .rise-cake {
        right: 1.54in;
        bottom: 0.88in;
        transform: rotate(2deg) scale(1.18);
      }
      .style-rise.cover .floral-left {
        left: 0.42in;
        top: 1.36in;
        transform: scaleX(-1) scale(1.05);
        color: ${transparent(tokens.rose, 0.54)};
      }
      .style-rise.cover .floral-right {
        right: 0.48in;
        bottom: 0.78in;
        transform: scale(1.22);
        color: ${transparent(tokens.rose, 0.82)};
      }
      .style-rise.type-welcome .rise-crown,
      .style-rise.type-welcome .rise-glass,
      .style-rise.type-welcome .floral-right {
        display: block;
      }
      .style-rise.type-welcome .content {
        max-width: 4.52in;
      }
      .style-rise.type-welcome .rise-crown {
        left: 0.68in;
        bottom: 1.08in;
        transform: scale(0.7);
      }
      .style-rise.type-welcome .rise-glass {
        right: 0.92in;
        bottom: 1.02in;
        transform: rotate(-5deg) scale(0.78);
      }
      .style-rise.type-welcome .floral-right {
        right: 0.64in;
        top: 2.42in;
      }
      .style-rise.type-toc .page-ribbon,
      .style-rise.type-quote .page-ribbon,
      .style-rise.type-section-divider .page-ribbon {
        display: none;
      }
      .style-rise.type-section-divider .image-slot,
      .style-rise.type-closing .image-slot {
        display: none;
      }
      .style-rise.type-section-divider .section-divider-box {
        position: relative;
        width: 5.85in;
        min-height: 3.1in;
        border-radius: 0.1in;
        background:
          linear-gradient(120deg, ${transparent(tokens.rose, 0.28)}, transparent 64%),
          ${transparent(tokens.paper, 0.78)};
        border: 1px solid ${transparent(tokens.accent, 0.44)};
        overflow: hidden;
        padding: 0.52in 0.58in;
      }
      .style-rise.type-section-divider .section-divider-box::after {
        content: "";
        position: absolute;
        right: -0.34in;
        top: -0.22in;
        width: 2.2in;
        height: 2.4in;
        transform: rotate(24deg);
        background:
          linear-gradient(110deg, transparent 0 28%, ${transparent(tokens.rose, 0.18)} 28% 60%, transparent 61%),
          linear-gradient(124deg, transparent 0 45%, ${transparent(tokens.accent, 0.16)} 45% 70%, transparent 71%);
      }
      .style-rise.type-section-divider .section-divider-box > * {
        position: relative;
        z-index: 2;
      }
      .style-rise.type-section-divider .brand-mark,
      .style-rise.type-section-divider .section-label {
        color: ${tokens.accent};
      }
      .style-rise.type-workbook .prompt-card {
        min-height: 1.24in;
        box-shadow: 0 0.08in 0.18in ${transparent(tokens.rose, 0.08)};
      }
      .style-rise.type-workbook .floral-right {
        display: block;
        right: 0.48in;
        bottom: 1.1in;
      }
      .style-rise.type-checklist .floral-right,
      .style-rise.type-tracker .floral-right,
      .style-rise.type-reflection .floral-right,
      .style-rise.type-progress-check .floral-right,
      .style-rise.type-resource .floral-right {
        display: block;
        right: 0.48in;
        bottom: 1.1in;
      }
      .style-rise.type-progress-check .content {
        border-left-color: ${tokens.rose};
        background:
          linear-gradient(112deg, ${transparent(tokens.rose, 0.12)}, transparent 58%),
          ${transparent(tokens.paper, 0.78)};
      }
      .style-rise.type-resource .alert-box {
        border-left-color: ${tokens.rose};
      }
      .style-rise.type-notes .rise-glass,
      .style-rise.type-notes .rise-cake,
      .style-rise.type-notes .floral-right {
        display: block;
      }
      .style-rise.type-notes .rise-glass {
        right: 0.78in;
        bottom: 0.98in;
        transform: rotate(-6deg) scale(0.72);
      }
      .style-rise.type-notes .rise-cake {
        left: 0.7in;
        bottom: 1.02in;
        transform: scale(0.72);
      }
      .style-rise.type-notes .floral-right {
        right: 0.7in;
        top: 2.2in;
      }
      .style-rise.type-closing .closing-panel {
        min-height: 7.25in;
      }
      .style-rise.type-closing .rise-glass,
      .style-rise.type-closing .rise-cake,
      .style-rise.type-closing .rise-crown,
      .style-rise.type-closing .floral-right {
        display: block;
      }
      .style-rise.type-closing .rise-glass {
        right: 0.94in;
        bottom: 1.02in;
        transform: rotate(-7deg);
      }
      .style-rise.type-closing .rise-cake {
        right: 1.48in;
        bottom: 1.02in;
      }
      .style-rise.type-closing .rise-crown {
        left: 50%;
        bottom: 2.02in;
        transform: translateX(-50%) scale(0.76);
      }
      .style-land.cover .image-slot,
      .style-land.type-section-divider .image-slot,
      .style-land.type-closing .image-slot,
      .style-rebuild.cover .image-slot,
      .style-rebuild.type-section-divider .image-slot,
      .style-rebuild.type-closing .image-slot {
        display: none;
      }
      .style-land.cover {
        align-content: start;
        padding: 0.36in 0.58in 0.42in;
        text-align: center;
        background:
          linear-gradient(145deg, ${transparent(tokens.plum, 0.22)} 0 25%, transparent 25.5% 100%),
          linear-gradient(22deg, ${transparent(tokens.plum, 0.28)} 0 19%, transparent 19.5% 100%),
          radial-gradient(circle at 18% 84%, ${transparent(tokens.sage, 0.22)} 0 0.9in, transparent 0.92in),
          repeating-linear-gradient(155deg, transparent 0 0.17in, ${transparent(tokens.gold, 0.16)} 0.18in 0.19in, transparent 0.2in 0.36in),
          ${tokens.paper};
      }
      .style-land.cover .cover-copy {
        margin: 0 auto;
        max-width: 5.2in;
        position: static;
      }
      .style-land.cover .brand-mark,
      .style-land.cover .cover-product,
      .style-land.cover .cover-tagline {
        margin-left: auto;
        margin-right: auto;
      }
      .style-land.cover .brand-mark {
        color: ${tokens.gold};
        font-size: 0;
        margin-bottom: 0.08in;
      }
      .style-land.cover .brand-mark::before {
        content: "";
        display: block;
        width: 0.78in;
        height: 0.28in;
        margin: 0 auto;
        background: ${tokens.gold};
        clip-path: polygon(0 85%, 28% 36%, 42% 58%, 58% 18%, 100% 85%, 88% 85%, 58% 42%, 43% 70%, 30% 54%, 12% 85%);
      }
      .style-land.cover .cover-brandline {
        color: ${tokens.background};
        font-size: 10px;
        margin-bottom: 0.12in;
      }
      .style-land.cover .cover-title {
        color: ${tokens.ink};
        font-size: 94px;
        letter-spacing: 0.12em;
        line-height: 0.86;
        margin: 0 auto;
        max-width: 5.8in;
      }
      .style-land.cover .cover-title.is-long {
        font-size: 54px;
        letter-spacing: 0.04em;
        line-height: 0.95;
        max-width: 5.6in;
      }
      .style-land.cover .cover-subtitle {
        color: ${tokens.background};
        font-size: 10.5px;
        letter-spacing: 0.32em;
        margin-top: 0.12in;
      }
      .style-land.cover .cover-divider {
        align-items: center;
        color: ${tokens.gold};
        display: flex;
        gap: 0.07in;
        justify-content: center;
        margin-top: 0.17in;
      }
      .style-land.cover .cover-divider::before,
      .style-land.cover .cover-divider::after {
        content: "";
        display: block;
        height: 1px;
        width: 0.44in;
        background: currentColor;
      }
      .style-land.cover .cover-divider span {
        display: block;
        width: 0.055in;
        height: 0.055in;
        background: currentColor;
        transform: rotate(45deg);
      }
      .style-land.cover .cover-kit-title {
        color: ${tokens.background};
        font-size: 35px;
        line-height: 0.98;
        margin: 0.14in auto 0;
        max-width: 3.9in;
      }
      .style-land.cover .cover-kit-title.is-long {
        font-size: 32px;
        max-width: 3.95in;
      }
      .style-land.cover .cover-product {
        background: ${tokens.plum};
        color: ${tokens.paper};
        border: 0;
        font-size: 10px;
        margin-top: 0.14in;
        padding: 8px 18px;
        box-shadow: 0 0.08in 0.16in ${transparent(tokens.ink, 0.12)};
      }
      .style-land.cover .cover-tagline {
        color: ${tokens.paper};
        font-size: 8.4px;
        left: 0.72in;
        margin: 0;
        position: absolute;
        right: 0.72in;
        bottom: 0.62in;
        z-index: 3;
        text-shadow: 0 1px 5px ${transparent(tokens.ink, 0.6)};
      }
      .style-land.cover .footer {
        display: none;
      }
      .style-land.cover .mountain-mark,
      .style-land.cover .land-compass,
      .style-land.cover .land-wrench,
      .style-land.cover .land-leaf {
        display: block;
      }
      .style-land.cover .mountain-mark {
        width: 5.05in;
        height: 2.15in;
        right: -0.34in;
        bottom: 0.12in;
        opacity: 0.42;
      }
      .style-land.cover .land-wrench {
        right: 0.78in;
        bottom: 0.74in;
        transform: rotate(-14deg) scale(1.18);
      }
      .style-land.cover .land-compass {
        right: 1.82in;
        bottom: 1.02in;
        transform: scale(1.05);
      }
      .style-land.cover .land-leaf {
        left: 0.28in;
        bottom: 0.72in;
        transform: scale(1.08);
      }
      .style-land.cover .spark-lines {
        display: block;
        left: 0.18in;
        right: auto;
        top: -0.08in;
        opacity: 0.28;
      }
      .style-land.type-welcome .content,
      .style-land.type-lesson .content,
      .style-land.type-lesson-continue .content {
        max-width: 4.92in;
      }
      .style-land.type-welcome .land-leaf,
      .style-land.type-welcome .land-compass,
      .style-land.type-lesson .land-wrench,
      .style-land.type-lesson-continue .land-compass {
        display: block;
      }
      .style-land.type-welcome .land-leaf {
        right: 0.58in;
        bottom: 0.9in;
      }
      .style-land.type-welcome .land-compass {
        right: 1.18in;
        bottom: 1.15in;
        transform: scale(0.82);
      }
      .style-land.type-lesson .land-wrench {
        right: 0.58in;
        bottom: 1in;
        transform: rotate(-14deg) scale(0.88);
      }
      .style-land.type-lesson-continue .land-compass {
        right: 0.7in;
        bottom: 1.05in;
        transform: scale(0.78);
      }
      .style-land.type-section-divider .section-divider-box {
        position: relative;
        border: 1px solid ${transparent(tokens.gold, 0.58)};
        border-radius: 0.05in;
        background:
          linear-gradient(136deg, ${transparent(tokens.plum, 0.9)} 0 25%, transparent 25.5%),
          linear-gradient(315deg, ${transparent(tokens.plum, 0.14)} 0 30%, transparent 30.5%),
          ${transparent(tokens.paper, 0.88)};
        min-height: 3.05in;
        padding: 0.54in 0.62in;
        overflow: hidden;
      }
      .style-land.type-section-divider .section-divider-box::after {
        content: "";
        position: absolute;
        right: -0.18in;
        bottom: -0.12in;
        width: 2.3in;
        height: 1.12in;
        background:
          linear-gradient(138deg, transparent 0 43%, ${transparent(tokens.gold, 0.32)} 43.4% 44%, transparent 44.5%),
          linear-gradient(148deg, transparent 0 52%, ${transparent(tokens.gold, 0.28)} 52.4% 53%, transparent 53.5%);
      }
      .style-land.type-section-divider .section-divider-box > * {
        position: relative;
        z-index: 2;
      }
      .style-land.type-workbook .mountain-mark,
      .style-land.type-checklist .land-wrench,
      .style-land.type-reflection .land-compass,
      .style-land.type-progress-check .land-leaf,
      .style-land.type-resource .mountain-mark,
      .style-land.type-resource .land-wrench,
      .style-land.type-tracker .land-leaf,
      .style-land.type-action-plan .land-compass,
      .style-land.type-notes .land-wrench,
      .style-land.type-notes .land-leaf,
      .style-land.type-closing .mountain-mark,
      .style-land.type-closing .land-wrench,
      .style-land.type-closing .land-compass {
        display: block;
      }
      .style-land.type-workbook .mountain-mark {
        width: 2.8in;
        right: -0.18in;
        bottom: 0.78in;
        opacity: 0.2;
      }
      .style-land.type-checklist .land-wrench {
        right: 0.7in;
        bottom: 0.96in;
        transform: rotate(-18deg) scale(0.76);
      }
      .style-land.type-reflection .land-compass {
        right: 0.7in;
        bottom: 1.05in;
        transform: scale(0.76);
      }
      .style-land.type-progress-check .land-leaf {
        right: 0.58in;
        bottom: 0.92in;
        transform: scale(0.82);
      }
      .style-land.type-progress-check .content {
        border-left-color: ${tokens.gold};
        border-radius: 0.04in;
      }
      .style-land.type-resource .mountain-mark {
        width: 2.95in;
        right: -0.2in;
        bottom: 0.78in;
        opacity: 0.24;
      }
      .style-land.type-resource .land-wrench {
        right: 0.64in;
        bottom: 0.96in;
        transform: rotate(-16deg) scale(0.72);
      }
      .style-land.type-tracker .land-leaf {
        right: 0.54in;
        bottom: 0.86in;
      }
      .style-land.type-action-plan .land-compass {
        right: 0.66in;
        bottom: 0.96in;
        transform: scale(0.78);
      }
      .style-land.type-notes .land-wrench {
        right: 0.64in;
        bottom: 0.92in;
        transform: rotate(-12deg) scale(0.7);
      }
      .style-land.type-notes .land-leaf {
        left: 0.42in;
        bottom: 0.76in;
        transform: scale(0.85);
      }
      .style-land.type-closing .closing-panel {
        min-height: 7.2in;
      }
      .style-land.type-closing .mountain-mark {
        width: 4.1in;
        height: 1.72in;
        right: -0.22in;
        bottom: 0.24in;
        opacity: 0.32;
      }
      .style-land.type-closing .land-wrench {
        right: 0.94in;
        bottom: 0.86in;
        transform: rotate(-15deg);
      }
      .style-land.type-closing .land-compass {
        right: 1.9in;
        bottom: 1.14in;
        transform: scale(0.86);
      }
      .style-rebuild.cover {
        text-align: left;
        align-content: center;
        padding-left: 0.72in;
        background:
          radial-gradient(ellipse at 96% 10%, ${transparent(tokens.blue, 0.34)}, transparent 42%),
          radial-gradient(ellipse at 78% 28%, ${transparent(tokens.rose, 0.24)}, transparent 46%),
          radial-gradient(ellipse at 10% 92%, ${transparent(tokens.sage, 0.18)}, transparent 35%),
          linear-gradient(118deg, transparent 0 62%, ${transparent(tokens.lilac, 0.18)} 62.5% 76%, transparent 76.5%),
          ${tokens.paper};
      }
      .style-rebuild.cover .cover-title {
        color: ${tokens.ink};
        font-size: 104px;
        max-width: 5.75in;
        margin: 0;
        letter-spacing: 0.08em;
        line-height: 0.86;
      }
      .style-rebuild.cover .cover-title.is-long {
        font-size: 72px;
        line-height: 0.88;
        letter-spacing: 0.035em;
        max-width: 6.28in;
      }
      .style-rebuild.cover .cover-subtitle {
        color: ${tokens.ink};
      }
      .style-rebuild.cover .cover-product {
        border-color: ${tokens.accent};
      }
      .style-rebuild .section-label {
        color: ${tokens.rose};
        font-size: 8.6px;
        font-weight: 800;
        letter-spacing: 0.33em;
      }
      .style-rebuild h2 {
        color: ${tokens.blue};
        font-size: 41px;
        letter-spacing: 0.018em;
        line-height: 0.98;
        text-transform: uppercase;
      }
      .style-rebuild .subtitle {
        color: ${tokens.rose};
        font-size: 22px;
        font-style: italic;
        font-weight: 600;
        letter-spacing: 0.01em;
        line-height: 1.05;
      }
      .style-rebuild p,
      .style-rebuild li,
      .style-rebuild .tracker-table,
      .style-rebuild .check-row .prompt-text {
        color: ${tokens.background};
      }
      .style-rebuild.type-notes h2 {
        color: ${tokens.rose};
        font-size: 30px;
        font-style: italic;
        letter-spacing: 0.01em;
        text-transform: none;
      }
      .style-rebuild.type-section-divider h2 {
        color: ${tokens.rose};
        font-size: 42px;
        letter-spacing: 0.02em;
      }
      .style-rebuild.type-section-divider .subtitle {
        color: ${tokens.background};
        font-family: "Poppins", Arial, sans-serif;
        font-size: 11px;
        font-style: normal;
        font-weight: 700;
        letter-spacing: 0.24em;
        line-height: 1.35;
        text-transform: uppercase;
      }
      .style-rebuild .quote-page .quote-mark {
        color: ${transparent(tokens.blue, 0.72)};
        font-size: 82px;
        margin-bottom: -12px;
      }
      .style-rebuild .quote-page .quote-text {
        color: ${tokens.background};
        font-size: 28px;
        font-weight: 400;
        line-height: 1.2;
      }
      .style-rebuild .quote-by {
        color: ${tokens.rose};
      }
      .style-rebuild .quote-by::before {
        background: ${tokens.gold};
      }
      .style-rebuild .prompt-card .prompt-text,
      .style-rebuild .reflect-box .prompt-text {
        color: ${tokens.background};
        font-size: 17px;
        font-style: italic;
        font-weight: 600;
        line-height: 1.13;
      }
      .style-rebuild .prompt-text::before {
        background: ${tokens.rose};
        border-radius: 999px;
        height: 6px;
        transform: none;
        width: 6px;
      }
      .style-rebuild .check-list li::before,
      .style-rebuild .soft-check::before {
        background: ${tokens.blue};
        border-radius: 999px;
      }
      .style-rebuild .key-term-label,
      .style-rebuild .key-term-title {
        color: ${tokens.blue};
      }
      .style-rebuild .key-term-box {
        border-left-color: ${tokens.blue};
      }
      .style-rebuild .alert-box {
        border-left-color: ${tokens.rose};
      }
      .style-rebuild .alert-icon,
      .style-rebuild .action-num {
        background: ${tokens.rose};
      }
      .style-rebuild.type-closing .closing-panel h1 {
        color: ${tokens.blue};
        font-size: 58px;
        letter-spacing: 0.12em;
        line-height: 0.86;
      }
      .style-rebuild.type-closing .cover-tagline {
        color: ${tokens.background};
        font-size: 8.4px;
        letter-spacing: 0.26em;
      }
      .style-rebuild.cover .rebuild-boxes,
      .style-rebuild.cover .rebuild-paint,
      .style-rebuild.cover .rebuild-frame,
      .style-rebuild.cover .floral-left,
      .style-rebuild.cover .floral-right {
        display: block;
      }
      .style-rebuild.cover .rebuild-boxes {
        right: 0.66in;
        bottom: 0.68in;
        transform: scale(1.24);
      }
      .style-rebuild.cover .rebuild-paint {
        right: 1.98in;
        bottom: 0.84in;
        transform: scale(1.05);
      }
      .style-rebuild.cover .rebuild-frame {
        right: 1.38in;
        bottom: 1.56in;
        transform: rotate(-3deg) scale(1.05);
      }
      .style-rebuild.cover .floral-left {
        left: 0.34in;
        bottom: 0.78in;
        top: auto;
        color: ${tokens.sage};
        transform: scaleX(-1) scale(1.08);
      }
      .style-rebuild.cover .floral-right {
        right: 0.42in;
        bottom: 1.04in;
        color: ${tokens.sage};
        transform: scale(1.12);
      }
      .style-rebuild.type-welcome .content,
      .style-rebuild.type-lesson .content,
      .style-rebuild.type-lesson-continue .content {
        max-width: 4.82in;
      }
      .style-rebuild.type-welcome .rebuild-frame,
      .style-rebuild.type-welcome .floral-right,
      .style-rebuild.type-lesson .rebuild-paint,
      .style-rebuild.type-lesson-continue .rebuild-boxes {
        display: block;
      }
      .style-rebuild.type-welcome .rebuild-frame {
        right: 0.82in;
        bottom: 1.05in;
        transform: rotate(3deg) scale(0.78);
      }
      .style-rebuild.type-welcome .floral-right {
        right: 0.46in;
        top: 2.25in;
      }
      .style-rebuild.type-lesson .rebuild-paint {
        right: 0.74in;
        bottom: 0.96in;
        transform: scale(0.78);
      }
      .style-rebuild.type-lesson-continue .rebuild-boxes {
        right: 0.64in;
        bottom: 0.92in;
        transform: scale(0.72);
      }
      .style-rebuild.type-section-divider .section-divider-box {
        position: relative;
        border: 1px solid ${transparent(tokens.blue, 0.42)};
        border-radius: 0.08in;
        background:
          radial-gradient(ellipse at 9% 14%, ${transparent(tokens.rose, 0.2)}, transparent 44%),
          radial-gradient(ellipse at 92% 16%, ${transparent(tokens.blue, 0.22)}, transparent 48%),
          ${transparent(tokens.paper, 0.82)};
        min-height: 3.15in;
        padding: 0.54in 0.62in;
      }
      .style-rebuild.type-section-divider .brand-mark,
      .style-rebuild.type-section-divider .section-label {
        color: ${tokens.accent};
      }
      .style-rebuild.type-workbook .floral-right,
      .style-rebuild.type-checklist .floral-right,
      .style-rebuild.type-reflection .floral-right,
      .style-rebuild.type-progress-check .floral-right,
      .style-rebuild.type-resource .floral-right,
      .style-rebuild.type-tracker .rebuild-boxes,
      .style-rebuild.type-action-plan .rebuild-paint,
      .style-rebuild.type-notes .rebuild-paint,
      .style-rebuild.type-notes .rebuild-frame,
      .style-rebuild.type-closing .rebuild-boxes,
      .style-rebuild.type-closing .rebuild-paint,
      .style-rebuild.type-closing .rebuild-frame,
      .style-rebuild.type-closing .floral-right {
        display: block;
      }
      .style-rebuild.type-workbook .floral-right,
      .style-rebuild.type-checklist .floral-right,
      .style-rebuild.type-reflection .floral-right,
      .style-rebuild.type-progress-check .floral-right,
      .style-rebuild.type-resource .floral-right {
        right: 0.42in;
        bottom: 1.02in;
      }
      .style-rebuild.type-progress-check .content {
        border-left-color: ${tokens.blue};
      }
      .style-rebuild.type-resource .key-term-box {
        border-left-color: ${tokens.blue};
      }
      .style-rebuild.type-tracker .rebuild-boxes {
        right: 0.56in;
        bottom: 0.82in;
        transform: scale(0.68);
      }
      .style-rebuild.type-action-plan .rebuild-paint {
        right: 0.72in;
        bottom: 0.92in;
        transform: scale(0.72);
      }
      .style-rebuild.type-notes .rebuild-paint {
        right: 0.74in;
        bottom: 0.9in;
        transform: scale(0.72);
      }
      .style-rebuild.type-notes .rebuild-frame {
        left: 0.62in;
        bottom: 0.92in;
        transform: rotate(-4deg) scale(0.72);
      }
      .style-rebuild.type-closing .closing-panel {
        min-height: 7.24in;
      }
      .style-rebuild.type-closing .rebuild-boxes {
        right: 0.86in;
        bottom: 0.78in;
      }
      .style-rebuild.type-closing .rebuild-paint {
        right: 2.08in;
        bottom: 0.9in;
      }
      .style-rebuild.type-closing .rebuild-frame {
        right: 1.5in;
        bottom: 1.56in;
        transform: rotate(-3deg);
      }
      .style-rebuild.type-closing .floral-right {
        right: 0.46in;
        bottom: 1.1in;
      }
      .style-meetatheal.cover .image-slot,
      .style-meetatheal.type-section-divider .image-slot,
      .style-meetatheal.type-closing .image-slot {
        display: none;
      }
      .style-meetatheal.cover {
        align-content: start;
        padding: 0.62in 0.62in 0.5in;
        text-align: center;
        background:
          linear-gradient(180deg, ${transparent(tokens.blue, 0.22)} 0, transparent 42%),
          radial-gradient(ellipse at 50% 78%, ${transparent(tokens.rose, 0.28)}, transparent 46%),
          radial-gradient(ellipse at 10% 16%, ${transparent(tokens.sage, 0.2)}, transparent 38%),
          radial-gradient(ellipse at 94% 22%, ${transparent(tokens.rose, 0.16)}, transparent 34%),
          ${tokens.paper};
      }
      .style-meetatheal.cover .cover-copy {
        margin: 0 auto;
        max-width: 5.05in;
        position: static;
      }
      .style-meetatheal.cover .brand-mark {
        color: ${tokens.rose};
        font-size: 31px;
        line-height: 1;
        margin-bottom: 0.12in;
      }
      .style-meetatheal.cover .cover-brandline {
        color: ${tokens.background};
        font-size: 8.5px;
        font-weight: 800;
        letter-spacing: 0.34em;
        margin-bottom: 0.14in;
      }
      .style-meetatheal.cover .cover-title {
        color: ${tokens.ink};
        font-size: 60px;
        letter-spacing: 0.045em;
        line-height: 0.9;
        margin: 0 auto;
        max-width: 4.5in;
        text-transform: uppercase;
      }
      .style-meetatheal.cover .cover-title.is-long {
        font-size: 50px;
        line-height: 0.94;
        max-width: 4.4in;
      }
      .style-meetatheal.cover .cover-subtitle {
        color: ${tokens.background};
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.26em;
        margin-top: 0.14in;
      }
      .style-meetatheal.cover .cover-divider {
        align-items: center;
        color: ${tokens.gold};
        display: flex;
        gap: 0.07in;
        justify-content: center;
        margin: 0.16in auto;
      }
      .style-meetatheal.cover .cover-divider::before,
      .style-meetatheal.cover .cover-divider::after {
        content: "";
        display: block;
        height: 1px;
        width: 0.44in;
        background: currentColor;
      }
      .style-meetatheal.cover .cover-divider span {
        display: block;
        width: 0.055in;
        height: 0.055in;
        background: currentColor;
        transform: rotate(45deg);
      }
      .style-meetatheal.cover .cover-product {
        background: transparent;
        border: 0;
        box-shadow: none;
        color: ${tokens.background};
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.3em;
        margin-top: 0;
        padding: 0;
      }
      .style-meetatheal.cover .road-mark,
      .style-meetatheal.cover .mountain-mark,
      .style-meetatheal.cover .floral-left,
      .style-meetatheal.cover .floral-right,
      .style-meetatheal.cover .heal-heart,
      .style-meetatheal.cover .heal-journals,
      .style-meetatheal.cover .heal-sun {
        display: block;
      }
      .style-meetatheal.cover .road-mark {
        width: 5.55in;
        height: 2.24in;
        left: 50%;
        bottom: 0.6in;
        opacity: 0.44;
      }
      .style-meetatheal.cover .mountain-mark {
        left: -0.08in;
        right: auto;
        bottom: 0.76in;
        width: 3.2in;
        height: 1.42in;
        opacity: 0.34;
      }
      .style-meetatheal.cover .floral-left {
        left: 0.2in;
        bottom: 0.7in;
        top: auto;
        color: ${tokens.sage};
        transform: scale(1.18);
      }
      .style-meetatheal.cover .floral-right {
        right: 0.2in;
        top: 0.98in;
        color: ${tokens.rose};
        transform: scale(1.15);
      }
      .style-meetatheal.cover .heal-heart {
        left: 50%;
        bottom: 2.02in;
        transform: translateX(-50%) rotate(-45deg) scale(0.84);
      }
      .style-meetatheal.cover .heal-journals {
        right: 0.76in;
        bottom: 0.72in;
        transform: scale(1.08);
      }
      .style-meetatheal.cover .heal-sun {
        left: 50%;
        top: 1.06in;
        transform: translateX(-50%);
      }
      .style-meetatheal h2 {
        font-size: 38px;
        line-height: 0.96;
      }
      .style-meetatheal.type-welcome .content,
      .style-meetatheal.type-lesson .content,
      .style-meetatheal.type-lesson-continue .content {
        max-width: 4.85in;
        border: 1px solid ${transparent(tokens.line, 0.64)};
        border-left: 0.05in solid ${tokens.gold};
        border-radius: 0.08in;
        padding: 0.22in 0.26in;
        background:
          linear-gradient(112deg, ${transparent(tokens.sage, 0.1)} 0 34%, transparent 62%),
          linear-gradient(70deg, transparent 0 58%, ${transparent(tokens.rose, 0.08)} 86%, transparent 100%),
          ${transparent(tokens.paper, 0.78)};
        box-shadow: 0 0.1in 0.24in ${transparent(tokens.background, 0.055)};
      }
      .style-meetatheal.type-welcome .heal-heart,
      .style-meetatheal.type-welcome .floral-right,
      .style-meetatheal.type-lesson .road-mark,
      .style-meetatheal.type-lesson-continue .heal-journals {
        display: block;
      }
      .style-meetatheal.type-welcome .heal-heart {
        right: 1.02in;
        bottom: 1.22in;
        transform: rotate(-45deg) scale(0.62);
      }
      .style-meetatheal.type-welcome .floral-right {
        right: 0.52in;
        top: 2.2in;
      }
      .style-meetatheal.type-lesson .road-mark {
        width: 3.3in;
        right: 0.32in;
        left: auto;
        bottom: 0.74in;
        opacity: 0.34;
      }
      .style-meetatheal.type-lesson-continue .heal-journals {
        right: 0.7in;
        bottom: 0.98in;
        transform: scale(0.78);
      }
      .style-meetatheal.type-section-divider .section-divider-box {
        position: relative;
        border: 1px solid ${transparent(tokens.gold, 0.42)};
        border-radius: 0.08in;
        background:
          linear-gradient(112deg, ${transparent(tokens.sage, 0.2)} 0 28%, transparent 52%),
          linear-gradient(62deg, transparent 0 48%, ${transparent(tokens.rose, 0.16)} 78%, transparent 100%),
          radial-gradient(ellipse at 18% 88%, ${transparent(tokens.blue, 0.18)}, transparent 44%),
          radial-gradient(ellipse at 88% 76%, ${transparent(tokens.rose, 0.24)}, transparent 40%),
          ${transparent(tokens.paper, 0.86)};
        min-height: 4.34in;
        width: 6.36in;
        padding: 0.66in 0.72in;
        overflow: hidden;
      }
      .style-meetatheal.type-section-divider .section-divider-box::after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: 0.18in;
        width: 3in;
        height: 1in;
        transform: translateX(-50%);
        opacity: 0.4;
        background:
          radial-gradient(ellipse at 43% 110%, transparent 0 42%, ${transparent(tokens.gold, 0.72)} 42.7% 43.4%, transparent 44%),
          radial-gradient(ellipse at 57% 110%, transparent 0 42%, ${transparent(tokens.rose, 0.45)} 42.7% 43.4%, transparent 44%);
      }
      .style-meetatheal.type-section-divider .section-divider-box > * {
        position: relative;
        z-index: 2;
      }
      .style-meetatheal.type-section-divider .section-divider-box h2 {
        color: ${tokens.rose};
        font-size: 48px;
        line-height: 0.94;
        max-width: 4.35in;
      }
      .style-meetatheal.type-section-divider .section-divider-box .subtitle {
        color: ${tokens.background};
        font-size: 24px;
      }
      .style-meetatheal.type-workbook .heal-heart,
      .style-meetatheal.type-workbook .floral-right,
      .style-meetatheal.type-checklist .floral-right,
      .style-meetatheal.type-reflection .heal-heart,
      .style-meetatheal.type-reflection .floral-right,
      .style-meetatheal.type-progress-check .road-mark,
      .style-meetatheal.type-progress-check .floral-right,
      .style-meetatheal.type-resource .mountain-mark,
      .style-meetatheal.type-resource .floral-left,
      .style-meetatheal.type-tracker .heal-journals,
      .style-meetatheal.type-action-plan .road-mark,
      .style-meetatheal.type-notes .heal-journals,
      .style-meetatheal.type-notes .heal-heart,
      .style-meetatheal.type-closing .road-mark,
      .style-meetatheal.type-closing .mountain-mark,
      .style-meetatheal.type-closing .floral-left,
      .style-meetatheal.type-closing .floral-right,
      .style-meetatheal.type-closing .heal-heart,
      .style-meetatheal.type-closing .heal-journals,
      .style-meetatheal.type-closing .heal-sun {
        display: block;
      }
      .style-meetatheal.type-workbook .heal-heart {
        right: 0.72in;
        bottom: 1.12in;
        transform: rotate(-45deg) scale(0.5);
      }
      .style-meetatheal.type-workbook .floral-right,
      .style-meetatheal.type-checklist .floral-right,
      .style-meetatheal.type-reflection .floral-right,
      .style-meetatheal.type-progress-check .floral-right {
        right: 0.46in;
        bottom: 1.02in;
      }
      .style-meetatheal.type-reflection .heal-heart {
        right: 0.92in;
        bottom: 1.18in;
        transform: rotate(-45deg) scale(0.48);
      }
      .style-meetatheal.type-progress-check .road-mark {
        width: 3.4in;
        right: 0.22in;
        left: auto;
        bottom: 0.72in;
        opacity: 0.22;
      }
      .style-meetatheal.type-progress-check .content {
        border-left-color: ${tokens.gold};
        background:
          linear-gradient(112deg, ${transparent(tokens.sage, 0.14)} 0 36%, transparent 62%),
          linear-gradient(68deg, transparent 0 54%, ${transparent(tokens.rose, 0.12)} 86%, transparent 100%),
          ${transparent(tokens.paper, 0.8)};
      }
      .style-meetatheal.type-resource .mountain-mark {
        width: 2.9in;
        left: -0.18in;
        bottom: 0.78in;
        opacity: 0.24;
      }
      .style-meetatheal.type-resource .floral-left {
        left: 0.38in;
        bottom: 0.88in;
        top: auto;
        color: ${tokens.sage};
      }
      .style-meetatheal.type-tracker .heal-journals {
        right: 0.68in;
        bottom: 0.92in;
        transform: scale(0.72);
      }
      .style-meetatheal.type-action-plan .road-mark {
        width: 3.2in;
        left: auto;
        right: 0.2in;
        bottom: 0.7in;
        opacity: 0.22;
      }
      .style-meetatheal.type-notes .heal-journals {
        left: 0.58in;
        bottom: 0.92in;
        transform: scale(0.72);
      }
      .style-meetatheal.type-notes .heal-heart {
        right: 0.82in;
        bottom: 1.1in;
        transform: rotate(-45deg) scale(0.48);
      }
      .style-meetatheal.type-closing .closing-panel {
        min-height: 7.24in;
      }
      .style-meetatheal.type-closing .road-mark {
        width: 4.8in;
        height: 2in;
        left: 50%;
        bottom: 0.76in;
        opacity: 0.34;
      }
      .style-meetatheal.type-closing .mountain-mark {
        left: 0.15in;
        right: auto;
        bottom: 0.96in;
        width: 2.55in;
        opacity: 0.28;
      }
      .style-meetatheal.type-closing .floral-left {
        left: 0.32in;
        bottom: 0.88in;
        top: auto;
        color: ${tokens.sage};
      }
      .style-meetatheal.type-closing .floral-right {
        right: 0.32in;
        top: 1.04in;
        color: ${tokens.rose};
      }
      .style-meetatheal.type-closing .heal-heart {
        left: 50%;
        bottom: 2.12in;
        transform: translateX(-50%) rotate(-45deg) scale(0.68);
      }
      .style-meetatheal.type-closing .heal-journals {
        right: 0.92in;
        bottom: 0.86in;
      }
      .style-meetatheal.type-closing .heal-sun {
        left: 50%;
        bottom: 1.75in;
        transform: translateX(-50%);
      }
      ${
        coverArt
          ? `.page.cover {
        background:
          linear-gradient(${transparent(tokens.paper, 0.04)}, ${transparent(tokens.paper, 0.04)}),
          url("${coverArt}") center / cover no-repeat,
          ${tokens.paper};
      }
      .page.cover::before,
      .page.cover::after,
      .page.cover .dots,
      .page.cover .swoop,
      .page.cover .decor::before,
      .page.cover .decor::after,
      .page.cover .watercolor,
      .page.cover .mountain-mark,
      .page.cover .tool-mark,
      .page.cover .road-mark,
      .page.cover .floral,
      .page.cover .spark-lines,
      .page.cover .brand-arc,
      .page.cover .brand-cup,
      .page.cover .brand-card,
      .page.cover .brand-laptop,
      .page.cover .brand-plant,
      .page.cover .brand-door,
      .page.cover .brand-book,
      .page.cover .rise-glass,
      .page.cover .rise-cake,
      .page.cover .rise-crown,
      .page.cover .land-compass,
      .page.cover .land-wrench,
      .page.cover .land-leaf,
      .page.cover .rebuild-boxes,
      .page.cover .rebuild-paint,
      .page.cover .rebuild-frame,
      .page.cover .heal-heart,
      .page.cover .heal-journals,
      .page.cover .heal-sun {
        display: none !important;
      }
      .style-land.page.cover {
        background:
          linear-gradient(${transparent(tokens.paper, 0.04)}, ${transparent(tokens.paper, 0.04)}),
          url("${coverArt}") center bottom / 116% auto no-repeat,
          ${tokens.paper};
      }
      .style-meetatheal.page.cover {
        background:
          linear-gradient(${transparent(tokens.paper, 0.02)}, ${transparent(tokens.paper, 0.02)}),
          url("${coverArt}") center / cover no-repeat,
          ${tokens.paper};
      }
      .style-meetatheal.motif-roads-hearts.type-section-divider {
        background:
          linear-gradient(${transparent(tokens.paper, 0.18)}, ${transparent(tokens.paper, 0.18)}),
          url("${coverArt}") center / cover no-repeat,
          ${tokens.paper};
      }
      .style-meetatheal.motif-roads-hearts.type-section-divider::after {
        opacity: 0.08;
      }`
          : ""
      }
      .page.cover {
        align-content: start;
        display: block;
        padding: 0.54in 0.62in 0.58in;
        text-align: center;
      }
      .page.cover .image-slot {
        display: none;
      }
      .page.cover .cover-copy {
        display: flex;
        flex-direction: column;
        align-items: center;
        max-width: 5.75in;
        min-height: 7.05in;
        margin: 0 auto;
        position: relative;
      }
      .page.cover .cover-brandline {
        color: ${tokens.background};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.3em;
        line-height: 1;
        margin: 0 0 0.12in;
        text-transform: uppercase;
        text-shadow: 0 1px 0 ${transparent(tokens.paper, 0.72)};
      }
      .page.cover .branch-cover-mark {
        color: ${tokens.accent};
        --mark-accent: ${tokens.gold};
        --mark-soft: ${transparent(tokens.accentSoft, 0.72)};
        width: 0.78in;
        height: 0.58in;
        margin: 0 auto 0.13in;
      }
      .page.cover .cover-title {
        color: ${tokens.ink};
        font-size: 84px;
        letter-spacing: 0.16em;
        line-height: 0.84;
        margin: 0 auto;
        max-width: 5.8in;
        text-align: center;
        text-transform: uppercase;
      }
      .page.cover .cover-title.is-long {
        font-size: 56px;
        letter-spacing: 0.045em;
        line-height: 0.92;
        max-width: 6.05in;
      }
      .page.cover .cover-subtitle {
        color: ${tokens.background};
        font-family: "Poppins", Arial, sans-serif;
        font-size: 9.5px;
        font-style: normal;
        font-weight: 700;
        letter-spacing: 0.3em;
        line-height: 1.3;
        margin: 0.14in 0 0;
        max-width: 4.7in;
        text-transform: uppercase;
      }
      .page.cover .cover-divider {
        align-items: center;
        color: ${tokens.accent};
        display: flex;
        gap: 0.08in;
        justify-content: center;
        margin: 0.16in auto 0;
      }
      .page.cover .cover-divider::before,
      .page.cover .cover-divider::after {
        content: "";
        display: block;
        height: 1px;
        width: 0.48in;
        background: currentColor;
      }
      .page.cover .cover-divider span {
        display: block;
        width: 0.055in;
        height: 0.055in;
        background: currentColor;
        transform: rotate(45deg);
      }
      .page.cover .cover-kit-title {
        color: ${tokens.background};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 36px;
        font-weight: 700;
        line-height: 0.98;
        margin: 0.22in auto 0;
        max-width: 4.9in;
        text-align: center;
        text-transform: uppercase;
      }
      .page.cover .cover-kit-title.is-long {
        font-size: 31px;
        max-width: 5.3in;
      }
      .page.cover .cover-product {
        background: transparent;
        border: 0;
        box-shadow: none;
        color: ${tokens.background};
        display: inline-block;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.28em;
        margin: 0.2in auto 0;
        padding: 0;
        text-transform: uppercase;
      }
      .page.cover .cover-mini-mark {
        display: none;
      }
      .page.cover .cover-tagline {
        color: ${tokens.background};
        position: absolute;
        left: 0.72in;
        right: 0.72in;
        bottom: 0.42in;
        z-index: 3;
        font-size: 8.4px;
        font-weight: 700;
        letter-spacing: 0.28em;
        margin: 0;
        text-align: center;
        text-shadow: 0 1px 5px ${transparent(tokens.paper, 0.72)};
        text-transform: uppercase;
      }
      .style-brand.page.cover .cover-title {
        color: ${tokens.ink};
      }
      .style-brand.page.cover .cover-kit-title,
      .style-brand.page.cover .cover-product,
      .style-brand.page.cover .cover-tagline,
      .style-brand.page.cover .cover-subtitle {
        color: ${tokens.ink};
      }
      .style-brand.page.cover .cover-brandline {
        color: ${tokens.ink};
      }
      .style-brand.page.cover .branch-cover-mark {
        color: ${tokens.plum};
        --mark-accent: ${tokens.gold};
      }
      .style-rise.page.cover .cover-title,
      .style-rise.page.cover .branch-cover-mark {
        color: ${tokens.rose};
      }
      .style-rise.page.cover .cover-divider {
        color: ${tokens.rose};
      }
      .style-land.page.cover .branch-cover-mark,
      .style-land.page.cover .cover-divider {
        color: ${tokens.gold};
      }
      .style-land.page.cover .cover-title {
        color: ${tokens.ink};
      }
      .style-land.page.cover .cover-tagline,
      .style-meetatheal.page.cover .cover-tagline {
        color: ${tokens.paper};
        text-shadow: 0 1px 5px ${transparent(tokens.background, 0.78)};
      }
      .style-rebuild.page.cover .cover-copy {
        align-items: center;
      }
      .style-rebuild.page.cover .cover-title,
      .style-rebuild.page.cover .branch-cover-mark {
        color: ${tokens.ink};
      }
      .style-rebuild.page.cover .cover-divider {
        color: ${tokens.gold};
      }
      .style-meetatheal.page.cover .cover-title {
        color: ${tokens.ink};
      }
      .style-meetatheal.page.cover .branch-cover-mark {
        color: ${tokens.rose};
        --mark-accent: ${tokens.blue};
      }
      ${
        coverArt
          ? `.page.cover,
      .style-brand.page.cover,
      .style-rise.page.cover,
      .style-land.page.cover,
      .style-rebuild.page.cover,
      .style-meetatheal.page.cover {
        background:
          linear-gradient(${transparent(tokens.paper, 0.03)}, ${transparent(tokens.paper, 0.03)}),
          url("${coverArt}") center / cover no-repeat,
          ${tokens.paper};
      }
      .style-brand.page.cover {
        background:
          linear-gradient(${transparent(tokens.paper, 0.015)}, ${transparent(tokens.paper, 0.015)}),
          url("${coverArt}") center bottom / 112% auto no-repeat,
          ${tokens.paper};
      }
      .style-rebuild.page.cover {
        background:
          linear-gradient(${transparent(tokens.paper, 0.012)}, ${transparent(tokens.paper, 0.012)}),
          url("${coverArt}") center bottom / 116% auto no-repeat,
          ${tokens.paper};
      }`
          : ""
      }
      .type-welcome.page {
        padding: 0.54in 0.62in 0.58in;
      }
      .type-welcome .watercolor,
      .type-welcome .mountain-mark,
      .type-welcome .tool-mark,
      .type-welcome .road-mark,
      .type-welcome .floral,
      .type-welcome .spark-lines,
      .type-welcome .brand-arc,
      .type-welcome .brand-cup,
      .type-welcome .brand-card,
      .type-welcome .brand-laptop,
      .type-welcome .brand-plant,
      .type-welcome .brand-door,
      .type-welcome .brand-book,
      .type-welcome .brand-light,
      .type-welcome .brand-pen,
      .type-welcome .brand-glasses,
      .type-welcome .rise-glass,
      .type-welcome .rise-cake,
      .type-welcome .rise-crown,
      .type-welcome .land-compass,
      .type-welcome .land-wrench,
      .type-welcome .land-leaf,
      .type-welcome .rebuild-boxes,
      .type-welcome .rebuild-paint,
      .type-welcome .rebuild-frame,
      .type-welcome .heal-heart,
      .type-welcome .heal-journals,
      .type-welcome .heal-sun {
        display: none !important;
      }
      .type-welcome .decor::before {
        background: ${transparent(tokens.plum, 0.13)};
        right: -0.74in;
        bottom: -0.46in;
        width: 2.18in;
        height: 2.18in;
      }
      .type-welcome .decor::after {
        background: ${transparent(tokens.accentSoft, 0.44)};
        left: -0.58in;
        top: -0.42in;
        width: 1.46in;
        height: 1.46in;
      }
      .type-welcome .welcome-frame {
        min-height: 7.05in;
        max-width: 5.75in;
        margin: 0 auto;
        padding: 0.46in 0.18in 0;
        position: relative;
        text-align: left;
      }
      .type-welcome .welcome-title {
        color: ${tokens.ink};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 54px;
        font-weight: 700;
        letter-spacing: 0.12em;
        line-height: 0.9;
        margin: 0;
        text-transform: uppercase;
      }
      .type-welcome .welcome-intro {
        color: ${tokens.background};
        font-size: 13px;
        font-weight: 500;
        line-height: 1.72;
        margin: 0.32in 0 0;
        max-width: 4.72in;
      }
      .type-welcome .welcome-benefits {
        display: grid;
        gap: 0.15in;
        list-style: none;
        margin: 0.42in 0 0;
        max-width: 4.95in;
        padding: 0;
      }
      .type-welcome .welcome-benefits li {
        align-items: center;
        color: ${tokens.ink};
        display: grid;
        font-size: 12px;
        font-weight: 600;
        gap: 0.15in;
        grid-template-columns: 0.34in 1fr;
        line-height: 1.42;
      }
      .type-welcome .welcome-benefit-icon {
        align-items: center;
        background: ${transparent(tokens.accentSoft, 0.58)};
        border: 1px solid ${transparent(tokens.accent, 0.72)};
        border-radius: 999px;
        color: ${tokens.accent};
        display: inline-flex;
        height: 0.32in;
        justify-content: center;
        width: 0.32in;
        --welcome-icon-accent: ${tokens.gold};
      }
      .type-welcome .welcome-benefit-icon svg {
        display: block;
        height: 0.2in;
        width: 0.2in;
      }
      .type-welcome .welcome-shape {
        border: 1px solid ${transparent(tokens.gold, 0.56)};
        border-radius: 999px;
        bottom: 0.78in;
        height: 1.54in;
        position: absolute;
        right: 0.34in;
        width: 1.54in;
        background:
          radial-gradient(circle at 44% 42%, ${transparent(tokens.accent, 0.28)} 0 0.17in, transparent 0.18in),
          radial-gradient(circle at 64% 62%, ${transparent(tokens.lilac, 0.34)} 0 0.34in, transparent 0.35in),
          radial-gradient(circle at 28% 72%, ${transparent(tokens.sage, 0.26)} 0 0.28in, transparent 0.29in),
          ${transparent(tokens.paper, 0.16)};
      }
      .type-welcome .welcome-shape::after {
        content: "";
        position: absolute;
        inset: 0.32in;
        border: 1px solid ${transparent(tokens.accent, 0.46)};
        border-radius: 999px;
      }
      .type-toc.page {
        padding: 0.54in 0.62in 0.58in;
      }
      .type-toc .decor::before {
        background: ${transparent(tokens.plum, 0.13)};
        left: -0.62in;
        top: -0.48in;
        width: 2.05in;
        height: 2.05in;
      }
      .type-toc .decor::after {
        background: ${transparent(tokens.accentSoft, 0.42)};
        right: -0.68in;
        bottom: -0.44in;
        width: 2.24in;
        height: 2.24in;
      }
      .type-toc .toc-frame {
        max-width: 5.75in;
        min-height: 7.05in;
        margin: 0 auto;
        padding: 1.02in 0.34in 0;
        position: relative;
      }
      .type-toc .toc-title {
        color: ${tokens.ink};
        font-family: "Cormorant Garamond", Georgia, serif;
        font-size: 43px;
        font-weight: 700;
        letter-spacing: 0.035em;
        line-height: 0.95;
        margin: 0;
        text-align: center;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .type-toc .toc-rule {
        align-items: center;
        color: ${tokens.accent};
        display: flex;
        gap: 0.08in;
        justify-content: center;
        margin: 0.32in auto 0;
      }
      .type-toc .toc-rule span {
        background: currentColor;
        display: block;
        height: 1px;
        width: 0.82in;
      }
      .type-toc .toc-rule i {
        background: currentColor;
        border-radius: 999px;
        display: block;
        height: 0.09in;
        width: 0.09in;
      }
      .type-toc .toc-list {
        display: grid;
        gap: 0.17in;
        margin: 0.48in auto 0;
        max-width: 5.18in;
      }
      .type-toc .toc-list.toc-backmatter {
        gap: 0.2in;
        margin-top: 0.26in;
      }
      .type-toc .toc-row {
        align-items: baseline;
        color: ${tokens.background};
        display: grid;
        font-size: 15px;
        grid-template-columns: 0.46in auto minmax(0.74in, 1fr) 0.36in;
        gap: 0.13in;
        line-height: 1;
      }
      .type-toc .toc-number {
        color: ${tokens.ink};
        font-weight: 800;
        letter-spacing: 0.08em;
      }
      .type-toc .toc-list.toc-backmatter .toc-number {
        color: transparent;
      }
      .type-toc .toc-section-title {
        color: ${tokens.background};
        font-weight: 500;
        min-width: 0;
        white-space: nowrap;
      }
      .type-toc .toc-leader {
        border-bottom: 1px dotted ${transparent(tokens.background, 0.78)};
        min-width: 0.48in;
        transform: translateY(-0.04in);
      }
      .type-toc .toc-page-number {
        color: ${tokens.ink};
        font-weight: 700;
        text-align: right;
      }
      .type-toc .toc-shape {
        border: 1px solid ${transparent(tokens.gold, 0.46)};
        border-radius: 999px;
        bottom: 0.02in;
        height: 1.92in;
        position: absolute;
        right: -0.28in;
        width: 1.92in;
      }
      .type-toc .toc-shape::before {
        content: "";
        position: absolute;
        inset: 0.28in;
        border: 1px solid ${transparent(tokens.accent, 0.36)};
        border-radius: 999px;
      }
      .type-toc .toc-shape::after {
        content: "";
        position: absolute;
        inset: 0.68in 0.32in 0.32in 0.68in;
        border-radius: 999px;
        background: ${transparent(tokens.lilac, 0.36)};
        box-shadow:
          -0.28in 0.18in 0 ${transparent(tokens.sage, 0.24)},
          0.16in -0.18in 0 ${transparent(tokens.accent, 0.22)};
      }
      .quote-page {
        display: grid;
        min-height: 7.7in;
        place-items: center;
        text-align: center;
      }
      .quote-page .quote-box {
        border: 0;
        background: transparent;
        max-width: 4.85in;
        padding: 0;
      }
      .quote-page .quote-mark {
        position: static;
        display: block;
        color: ${tokens.accent};
        font-size: 72px;
        margin-bottom: -14px;
      }
      .quote-page .quote-text {
        font-size: 30px;
        font-style: normal;
        line-height: 1.22;
      }
      .quote-page .quote-by::before {
        left: 50%;
        transform: translateX(-50%);
      }
      .section-divider-page {
        display: grid;
        min-height: 7.7in;
        place-items: center;
        text-align: center;
      }
      .section-divider-box {
        max-width: 5in;
      }
      .section-divider-box h2 {
        font-size: 42px;
        margin: 0 auto;
      }
      .section-divider-box .subtitle {
        font-size: 18px;
      }
      .closing-panel {
        display: grid;
        place-items: center;
        min-height: 5.3in;
        text-align: center;
      }
      .closing-panel h1 {
        color: ${tokens.ink};
        font-size: 52px;
        text-transform: uppercase;
      }
      .closing-panel .subtitle {
        max-width: 4.2in;
        margin: 16px auto 0;
      }`
}

function renderPage(
  page: KitPage,
  index: number,
  total: number,
  kit: ParsedKit,
  preset: DesignPresetTokens,
  branch: BranchInfo,
  target: RenderTarget
) {
  if (page.type === "cover") {
    return renderCoverPage(page, kit, preset, target)
  }

  if (page.type === "welcome") {
    return renderWelcomePage(page, index, total, preset, branch)
  }

  if (page.type === "toc") {
    return renderTocPage(page, index, total, kit, preset, branch)
  }

  if (page.type === "lesson" && preset.styleFamily === "brand") {
    return renderLessonContentPage(page, index, total, kit, preset)
  }

  if (page.type === "closing") {
    return renderClosingPage(page, index, total, kit, preset, branch)
  }

  const typeClass = page.rawType || "page"
  const presetClasses = presetClassName(preset)
  const header = page.type === "quote" || page.type === "section-divider" ? "" : renderPageHeader(page)
  const body = renderPageBody(page, kit, preset)

  return `<section class="page ${presetClasses} type-${escapeHtml(typeClass)}">
    ${renderDecor()}
    <div class="page-ribbon">${escapeHtml(page.section || titleFromType(page.rawType))}</div>
    ${header}
    ${body}
    ${page.imageSlot ? `<div class="image-slot"></div>` : ""}
    ${page.bottomNote ? `<div class="bottom-note">${escapeHtml(page.bottomNote)}</div>` : ""}
    ${footer(index, total, branch)}
  </section>`
}

function renderLessonContentPage(
  page: KitPage,
  index: number,
  total: number,
  kit: ParsedKit,
  preset: DesignPresetTokens
) {
  const presetClasses = presetClassName(preset)
  const intro = lessonIntro(page)
  const sidebarBullets = lessonSidebarBullets(page)
  const sections = lessonContentSections(page)
  const takeaway = lessonTakeaway(page)

  return `<section class="page ${presetClasses} type-lesson">
    ${renderDecor()}
    <div class="lesson-content-page">
      <aside class="lesson-sidebar">
        <div class="lesson-kicker">${escapeHtml(lessonKicker(page, index))}</div>
        <h1 class="lesson-title">${escapeHtml(page.title || kit.title)}</h1>
        ${intro ? `<p class="lesson-intro">${escapeHtml(intro)}</p>` : ""}
        ${
          sidebarBullets.length > 0
            ? `<div class="lesson-sidebar-list-label">In this lesson</div><ul class="lesson-sidebar-list">${sidebarBullets
                .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
                .join("")}</ul>`
            : ""
        }
        <div class="lesson-sidebar-mark">B<span>C</span></div>
      </aside>
      <main class="lesson-main">
        ${sections.map(renderLessonContentSection).join("")}
      </main>
      <div class="lesson-takeaway-box">
        <div class="lesson-takeaway-label">Key Takeaway</div>
        <div class="lesson-takeaway-text">${escapeHtml(takeaway)}</div>
      </div>
    </div>
    <div class="lesson-footer-mark">B<span>C</span></div>
    <div class="lesson-page-number">${index + 1} / ${total}</div>
  </section>`
}

function renderLessonContentSection(section: LessonContentSection, index: number) {
  return `<section class="lesson-section">
    <div class="lesson-number">${String(index + 1).padStart(2, "0")}</div>
    <div>
      <div class="lesson-section-title">${escapeHtml(section.title)}</div>
      <p class="lesson-section-body">${escapeHtml(section.text)}</p>
    </div>
  </section>`
}

type LessonContentSection = {
  title: string
  text: string
}

function lessonKicker(page: KitPage, index: number) {
  const section = page.section.trim()

  if (/lesson\s+\d+/i.test(section)) {
    return section
  }

  const lessonNumber = String(index + 1).padStart(2, "0")

  return `Lesson ${lessonNumber}`
}

function lessonIntro(page: KitPage) {
  const firstParagraph = lessonTeachingParagraphs(page)[0]

  return firstParagraph || page.subtitle
}

function lessonContentSections(page: KitPage): LessonContentSection[] {
  const paragraphs = lessonTeachingParagraphs(page)
  const paragraphSections = paragraphs
    .slice(1)
    .map(splitLessonSectionParagraph)
    .filter((section): section is LessonContentSection => Boolean(section))
  const bodySources = [
    ...paragraphs.slice(1).filter((paragraph) => !splitLessonSectionParagraph(paragraph)),
    page.bottomNote,
    paragraphs[0],
  ].filter((value) => value.trim())

  return Array.from({ length: 3 }).map((_, index) => {
    const structured = paragraphSections[index]
    const title =
      structured?.title ||
      ["Why This Matters", "What To Decide", "How To Use It"][index]
    const text =
      structured?.text ||
      bodySources[index] ||
      bodySources[0] ||
      page.subtitle ||
      page.title

    return {
      title,
      text: trimLessonBody(text),
    }
  })
}

function lessonTakeaway(page: KitPage) {
  const paragraphs = lessonParagraphs(page)

  return page.bottomNote || paragraphs.at(-1) || page.subtitle || page.title
}

function lessonParagraphs(page: KitPage) {
  return page.content
    .filter((block) => block.type === "paragraph")
    .map((block) => block.text.trim())
    .filter(Boolean)
}

function lessonChecks(page: KitPage) {
  return page.content
    .flatMap((block) => (block.type === "check-list" ? block.items : []))
    .map((item) => item.trim())
    .filter(Boolean)
}

function lessonSidebarBullets(page: KitPage) {
  return lessonChecks(page).slice(0, 4)
}

function lessonTeachingParagraphs(page: KitPage) {
  return lessonParagraphs(page).filter((paragraph) => !/^in this lesson\b/i.test(paragraph))
}

function splitLessonSectionParagraph(text: string): LessonContentSection | null {
  const match = text.match(/^(.{3,70}):\s+(.{12,})$/)

  if (!match) {
    return null
  }

  return {
    title: cleanLessonTitle(match[1]),
    text: trimLessonBody(match[2]),
  }
}

function cleanLessonTitle(value = "") {
  return value.trim().replace(/[.:;]+$/g, "")
}

function trimLessonBody(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function renderWelcomePage(
  page: KitPage,
  index: number,
  total: number,
  preset: DesignPresetTokens,
  branch: BranchInfo
) {
  const presetClasses = presetClassName(preset)
  const intro = welcomeIntro(page)
  const benefits = welcomeBenefits(page)

  return `<section class="page ${presetClasses} type-welcome">
    ${renderDecor()}
    <div class="welcome-frame">
      <h1 class="welcome-title">WELCOME</h1>
      ${intro ? `<p class="welcome-intro">${escapeHtml(intro)}</p>` : ""}
      ${
        benefits.length > 0
          ? `<ul class="welcome-benefits">${benefits
              .map(
                (benefit) =>
                  `<li><span class="welcome-benefit-icon">${renderWelcomeBenefitIcon(preset)}</span><span>${escapeHtml(
                    benefit
                  )}</span></li>`
              )
              .join("")}</ul>`
          : ""
      }
      <div class="welcome-shape"></div>
    </div>
    ${footer(index, total, branch)}
  </section>`
}

function renderTocPage(
  page: KitPage,
  index: number,
  total: number,
  kit: ParsedKit,
  preset: DesignPresetTokens,
  branch: BranchInfo
) {
  const presetClasses = presetClassName(preset)
  const { mainRows, backMatterRows } = tableOfContentsRows(page, kit)

  return `<section class="page ${presetClasses} type-toc">
    ${renderDecor()}
    <div class="toc-frame">
      <h1 class="toc-title">TABLE OF CONTENTS</h1>
      <div class="toc-rule"><span></span><i></i><span></span></div>
      ${renderTocRowGroup(mainRows, "toc-list")}
      ${renderTocRowGroup(backMatterRows, "toc-list toc-backmatter")}
      <div class="toc-shape"></div>
    </div>
    ${footer(index, total, branch)}
  </section>`
}

function renderCoverPage(
  page: KitPage,
  kit: ParsedKit,
  preset: DesignPresetTokens,
  target: RenderTarget
) {
  const cover = coverData(page, kit, preset, target)
  const presetClasses = presetClassName(preset)

  return `<section class="page cover ${presetClasses} type-cover">
    ${renderDecor()}
    <div class="cover-copy">
      <div class="cover-brandline">Best Collective</div>
      <div class="branch-cover-mark">${renderBranchCoverMark(preset)}</div>
      <h1 class="${cover.branchTitleClass}">${renderCoverTitle(cover.branchTitle)}</h1>
      <div class="cover-divider"><span></span></div>
      <div class="${cover.kitTitleClass}">${escapeHtml(cover.kitTitle)}</div>
      ${cover.subtitle ? `<div class="cover-subtitle">${escapeHtml(cover.subtitle)}</div>` : ""}
      <div class="cover-product">${escapeHtml(cover.productLabel)}</div>
    </div>
    ${cover.tagline ? `<div class="cover-tagline">${escapeHtml(cover.tagline)}</div>` : ""}
    ${page.imageSlot ? `<div class="image-slot"></div>` : ""}
  </section>`
}

function welcomeIntro(page: KitPage) {
  const paragraph = page.content.find((block) => block.type === "paragraph")

  if (paragraph?.type === "paragraph") {
    return paragraph.text
  }

  return page.subtitle
}

function welcomeBenefits(page: KitPage) {
  const checks = page.content.find((block) => block.type === "check-list")

  if (checks?.type === "check-list") {
    return checks.items.slice(0, 5)
  }

  const list = page.content.find((block) => block.type === "list")

  if (list?.type === "list") {
    return list.items.slice(0, 5)
  }

  return page.checks.slice(0, 5)
}

function renderWelcomeBenefitIcon(preset: DesignPresetTokens) {
  if (preset.branch === "rise") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 5c3.2 0 5.8 2.4 5.8 5.4 0 3.9-3 6.5-5.8 7.8-2.8-1.3-5.8-3.9-5.8-7.8C6.2 7.4 8.8 5 12 5Z" />
      <path d="M8.4 11.2c3.4.3 6.6-.8 9.1-3.2M10.4 17.4c-3.2-.7-5.6-2.5-6.7-5.1" stroke="var(--welcome-icon-accent)" />
    </svg>`
  }

  if (preset.branch === "land") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3.5 18.5 8.8 9.7l3 4.2 4-7 4.7 11.6h-17Z" />
      <path d="M8.8 9.7 10.5 14m5.3-7.1 1.1 5.4" stroke="var(--welcome-icon-accent)" />
    </svg>`
  }

  if (preset.branch === "meetatheal") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11.5 18.5C6.8 15 4.7 12 5.2 9.4c.6-2.8 4.1-3.5 6.3-.8 2.2-2.7 5.7-2 6.3.8.5 2.6-1.6 5.6-6.3 9.1Z" />
      <path d="M13.2 18.5c4.7-3.5 6.8-6.5 6.3-9.1-.6-2.8-4.1-3.5-6.3-.8" stroke="var(--welcome-icon-accent)" />
    </svg>`
  }

  if (preset.branch === "rebuild") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 19V5h7.2A4.8 4.8 0 0 1 19 9.8V19" />
      <path d="M11 19V8.4h4M4.5 19h15M15.5 16.5c0-3 2.4-5.4 5.1-5.4" stroke="var(--welcome-icon-accent)" />
    </svg>`
  }

  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5.5 15.5h8.7v-7H5.5v7Z" />
    <path d="M4 18h12M9 15.5 8.2 18m4.2-2.5.8 2.5" />
    <path d="M16.2 18c2.1 0 3.6-1.4 3.6-3.8h-5c0 2.4 1.2 3.8 3.4 3.8Z" stroke="var(--welcome-icon-accent)" />
  </svg>`
}

function coverData(
  page: KitPage,
  kit: ParsedKit,
  preset: DesignPresetTokens,
  target: RenderTarget
) {
  const branchTitle = coverBranchTitle(preset)
  const productLabel = coverProductLabel(kit, preset, target)
  const kitTitle = coverKitTitle(page.title || kit.title || productLabel, branchTitle, productLabel)
  const subtitle = coverSubtitle(page, kit, kitTitle)
  const tagline = page.tagline || kit.tagline || defaultCoverTagline(preset)

  return {
    branchTitle,
    branchTitleClass: `cover-title ${branchTitle.replace(/\s+/g, "").length > 8 ? "is-long" : ""}`.trim(),
    kitTitle,
    kitTitleClass: `cover-kit-title ${kitTitle.length > 28 ? "is-long" : ""}`.trim(),
    productLabel,
    subtitle,
    tagline,
  }
}

function coverBranchTitle(preset: DesignPresetTokens) {
  if (preset.branch === "meetatheal") {
    return "Meet at\nthe Heal"
  }

  if (preset.branch === "brand") {
    return "Brand"
  }

  if (preset.branch === "rise") {
    return "Rise"
  }

  if (preset.branch === "land") {
    return "Land"
  }

  if (preset.branch === "rebuild") {
    return "Rebuild"
  }

  return "Best Collective"
}

function coverKitTitle(title: string, branchTitle: string, productLabel: string) {
  const branchPlain = branchTitle.replace(/\s+/g, " ").trim()
  let kitTitle = cleanCoverKitTitle(title)

  kitTitle = kitTitle
    .replace(new RegExp(`^${escapeRegExp(branchPlain)}\\s*[:|-]?\\s*`, "i"), "")
    .replace(/^(lesson guide|workbook|lesson book|couples workbook)\s*[:|-]?\s*/i, "")
    .trim()

  return kitTitle || productLabel
}

function coverSubtitle(page: KitPage, kit: ParsedKit, kitTitle: string) {
  const subtitle = (page.subtitle || kit.subtitle || "").trim()

  if (!subtitle || subtitle.toLowerCase() === kitTitle.toLowerCase()) {
    return ""
  }

  return subtitle
}

function renderCoverTitle(title: string) {
  return title
    .split(/\n+/)
    .map((part) => escapeHtml(part))
    .join("<br />")
}

function defaultCoverTagline(preset: DesignPresetTokens) {
  if (preset.branch === "meetatheal") {
    return "Two Worlds. One Choice. A Stronger We."
  }

  if (preset.branch === "rise") {
    return "Come Back To Yourself."
  }

  if (preset.branch === "land") {
    return "Build. Grow. Stand Firm."
  }

  if (preset.branch === "rebuild") {
    return "New Season. New Story. New You."
  }

  return "One System. Five Rooms. All For You."
}

function renderBranchCoverMark(preset: DesignPresetTokens) {
  if (preset.branch === "rise") {
    return `<svg viewBox="0 0 96 72" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M48 18c8 0 15 6 15 14 0 10-8 17-15 20-7-3-15-10-15-20 0-8 7-14 15-14Z" />
      <path d="M39 27c6-8 17-8 22 1M37 36c9 1 19-2 25-9M43 49c1 8 1 13-1 17" />
      <path d="M42 58c-10-2-18-8-21-17 9-1 17 4 21 17ZM46 59c10-2 17-9 20-18-9 0-17 6-20 18Z" />
      <path d="M22 25c5-10 14-16 26-16s21 6 26 16" stroke="var(--mark-accent)" stroke-width="1.8" opacity=".78" />
      <path d="M18 37c1 11 7 20 17 25M78 37c-1 11-7 20-17 25" stroke="var(--mark-accent)" stroke-width="1.8" opacity=".62" />
    </svg>`
  }

  if (preset.branch === "land") {
    return `<svg viewBox="0 0 96 72" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 57 33 31l10 13 15-26 24 39H14Z" />
      <path d="m33 31 5 12m20-25 5 21M24 57c9-5 17-6 26-2 9 4 17 3 26-2" stroke="var(--mark-accent)" stroke-width="2.1" opacity=".82" />
      <path d="M18 50v-8m0 0-5 5m5-5 5 5M78 51v-9m0 0-5 5m5-5 5 5" stroke-width="2.2" />
    </svg>`
  }

  if (preset.branch === "meetatheal") {
    return `<svg viewBox="0 0 96 72" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M45 55C29 43 21 33 23 24c2-9 14-12 22-2 8-10 20-7 22 2 2 9-6 19-22 31Z" />
      <path d="M52 55C68 43 76 33 73 24c-2-9-14-12-22-2" stroke="var(--mark-accent)" />
      <path d="M18 35c3-14 14-23 30-23s27 9 30 23" stroke="var(--mark-accent)" stroke-width="1.8" opacity=".52" />
    </svg>`
  }

  if (preset.branch === "rebuild") {
    return `<svg viewBox="0 0 96 72" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round">
      <path d="M31 61V16h24c9 0 16 7 16 16v29" />
      <path d="M44 61V25h13M31 61h47M59 53c0-11 9-20 20-20M79 61V33" stroke="var(--mark-accent)" />
      <path d="M18 61h22M22 52c6-2 11-1 16 2M22 43c6 0 11 3 15 8" stroke-width="2.1" opacity=".72" />
      <path d="M61 61c3-8 10-13 18-13" stroke="var(--mark-accent)" stroke-width="2.1" opacity=".72" />
    </svg>`
  }

  return `<svg viewBox="0 0 96 72" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M24 46h34V22H24v24Z" />
    <path d="M18 53h47M35 46l-3 7m18-7 3 7" />
    <path d="M67 54c8 0 13-5 13-13H64c0 8 4 13 11 13Z" />
    <path d="M80 43h5c4 0 4 7-2 8" />
    <path d="M65 27h17v12H65V27Z" stroke="var(--mark-accent)" />
    <path d="M69 32h9M69 36h5" stroke="var(--mark-accent)" stroke-width="2" />
    <path d="M60 18c8-7 17-7 25-1" stroke="var(--mark-accent)" stroke-width="1.8" opacity=".68" />
  </svg>`
}

function renderClosingPage(
  page: KitPage,
  index: number,
  total: number,
  kit: ParsedKit,
  preset: DesignPresetTokens,
  branch: BranchInfo
) {
  const title = page.title || branch.name || kit.title
  const subtitle = page.subtitle || kit.subtitle
  const tagline = page.tagline || kit.tagline
  const presetClasses = presetClassName(preset)

  if (preset.styleFamily === "brand") {
    const closingHeadline = subtitle || kit.subtitle || title

    return `<section class="page ${presetClasses} type-closing">
    ${renderDecor()}
    <div class="closing-panel">
      <div>
        <div class="brand-mark">${renderIcon(preset)}</div>
        <div class="cover-brandline">${escapeHtml(title)}</div>
        <h1>${escapeHtml(closingHeadline)}</h1>
        ${tagline ? `<div class="cover-tagline">${escapeHtml(tagline)}</div>` : ""}
      </div>
    </div>
    ${page.imageSlot ? `<div class="image-slot"></div>` : ""}
    ${footer(index, total, branch)}
  </section>`
  }

  return `<section class="page ${presetClasses} type-closing">
    ${renderDecor()}
    <div class="closing-panel">
      <div>
        <div class="brand-mark">${renderIcon(preset)}</div>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ""}
        ${tagline ? `<div class="cover-tagline">${escapeHtml(tagline)}</div>` : ""}
      </div>
    </div>
    ${page.imageSlot ? `<div class="image-slot"></div>` : ""}
    ${footer(index, total, branch)}
  </section>`
}

function renderPageHeader(page: KitPage) {
  return `<div class="section-label">${escapeHtml(page.section || titleFromType(page.rawType))}</div>
    <h2>${escapeHtml(page.title || titleFromType(page.rawType))}</h2>
    ${page.subtitle ? `<div class="subtitle">${escapeHtml(page.subtitle)}</div>` : ""}`
}

function renderPageBody(page: KitPage, kit: ParsedKit, preset: DesignPresetTokens) {
  if (page.type === "quote") {
    return `<div class="quote-page">${renderContent(page.content)}</div>`
  }

  if (page.type === "section-divider") {
    return `<div class="section-divider-page"><div class="section-divider-box">
      <div class="section-label">${escapeHtml(page.section || "Section")}</div>
      <h2>${escapeHtml(page.title || kit.title)}</h2>
      ${page.subtitle ? `<div class="subtitle">${escapeHtml(page.subtitle)}</div>` : ""}
      <div class="brand-mark">${renderIcon(preset)}</div>
    </div></div>`
  }

  if (page.type === "toc") {
    return `<div class="content">${renderToc(page, kit)}</div>`
  }

  if (page.type === "case-study") {
    return `<div class="content">${renderContent(page.content)}${renderCaseStudy(page)}</div>`
  }

  return `<div class="content">${renderContent(page.content)}${renderFillableArea(page, kit)}</div>`
}

function renderContent(blocks: ContentBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === "paragraph") {
        return `<p>${escapeHtml(block.text)}</p>`
      }

      if (block.type === "list") {
        return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      }

      if (block.type === "check-list") {
        return `<ul class="check-list">${block.items
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}</ul>`
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

      return `<div class="reflect-box"><div class="prompt-text">${escapeHtml(block.text)}</div></div>`
    })
    .join("")
}

function renderFillableArea(page: KitPage, kit: ParsedKit) {
  if (page.type === "workbook") {
    return `<div class="prompt-stack">${page.prompts
      .map((prompt, index) =>
        renderPromptCard(prompt, 3, {
          suffix: `prompt_${String(index + 1).padStart(2, "0")}`,
          multiline: true,
        })
      )
      .join("")}</div>`
  }

  if (page.type === "checklist") {
    const items = page.checks.length > 0 ? page.checks : ["Item to complete"]

    return `<div class="prompt-stack">${items
      .map(
        (item, index) =>
          `<div class="check-row"><span class="check-box" ${fillableAttrs({
            kind: "checkbox",
            suffix: `check_${String(index + 1).padStart(2, "0")}`,
          })}></span><span class="prompt-text">${escapeHtml(item)}</span></div>`
      )
      .join("")}</div>${
      page.noteLabel
        ? renderPromptCard(page.noteLabel, 2, {
            suffix: "notes_01",
            multiline: true,
            fontSize: 9.5,
          })
        : ""
    }`
  }

  if (page.type === "tracker") {
    return renderTracker(page, kit)
  }

  if (page.type === "action-plan") {
    const actions = page.actions.length > 0 ? page.actions : ["What is the next action?"]

    return `<div class="action-grid">${actions
      .map(
        (action, index) => `<div class="action-card"><span class="action-num">${index + 1}</span><div>${renderPromptCard(
          action,
          2,
          {
            suffix: `action_${String(index + 1).padStart(2, "0")}`,
            multiline: true,
          }
        )}</div></div>`
      )
      .join("")}</div>${page.questions
      .map((question, index) =>
        renderPromptCard(question, 1, {
          suffix: `question_${String(index + 1).padStart(2, "0")}`,
          multiline: true,
          fontSize: 9.5,
        })
      )
      .join("")}`
  }

  if (page.type === "notes") {
    return `<div class="notes-field" ${fillableAttrs({
      kind: "text",
      suffix: "notes_01",
      multiline: true,
      insetX: 8,
      insetY: 22,
    })}></div>`
  }

  return ""
}

function renderPromptCard(
  prompt: string,
  lineCount: number,
  field?: {
    suffix: string
    multiline?: boolean
    fontSize?: number
    textColor?: "plum" | "white"
  }
) {
  return `<div class="prompt-card lines-${lineCount}"><div class="prompt-text">${escapeHtml(
    prompt
  )}</div><div class="writing-lines">${Array.from({ length: lineCount })
    .map(() => "<span></span>")
    .join("")}</div>${
    field
      ? `<div class="fillable-text-target" ${fillableAttrs({
          kind: "text",
          suffix: field.suffix,
          multiline: field.multiline,
          fontSize: field.fontSize,
          textColor: field.textColor,
        })}></div>`
      : ""
  }</div>`
}

function renderTracker(page: KitPage, kit: ParsedKit) {
  const headers = page.tableHeaders.length > 0 ? page.tableHeaders : ["Category", "Goal", "Actual", "Notes"]
  const rows = trackerRowsForPage(page, kit)

  return `<table class="tracker-table">
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${rows
      .map(
        (row, rowIndex) =>
          `<tr><td>${escapeHtml(row)}</td>${headers
            .slice(1)
            .map(
              (_, columnIndex) =>
                `<td ${fillableAttrs({
                  kind: "text",
                  suffix: `table_row${String(rowIndex + 1).padStart(2, "0")}_col${String(
                    columnIndex + 2
                  ).padStart(2, "0")}`,
                  multiline: columnIndex === headers.length - 2,
                  fontSize: 8.5,
                  insetX: 4,
                  insetY: 4,
                })}></td>`
            )
            .join("")}</tr>`
      )
      .join("")}</tbody>
  </table>${
    page.noteLabel
      ? renderPromptCard(page.noteLabel, 2, {
          suffix: "notes_01",
          multiline: true,
          fontSize: 9.5,
        })
      : ""
  }`
}

function trackerRowsForPage(page: KitPage, kit: ParsedKit) {
  const rows = page.tableRows.length > 0 ? [...page.tableRows] : ["Revenue", "Expenses", "Profit", "Notes"]
  const chapterCount = Math.max(
    kit.pages.filter((kitPage) => kitPage.type === "lesson").length,
    kit.pages.filter((kitPage) => kitPage.type === "workbook").length
  )

  if (chapterCount <= rows.length || !looksLikeChapterTracker(page, rows)) {
    return rows
  }

  const prefix = rows.find((row) => /\b(chapter|lesson|section)\s+\d+\b/i.test(row))?.match(
    /\b(chapter|lesson|section)\b/i
  )?.[1] ?? "Chapter"
  const existingNumbers = new Set(
    rows
      .map((row) => row.match(/\b(?:chapter|lesson|section)\s+(\d+)\b/i)?.[1])
      .filter((number): number is string => Boolean(number))
      .map(Number)
  )

  for (let number = 1; number <= chapterCount; number += 1) {
    if (!existingNumbers.has(number)) {
      rows.push(`${titleFromType(prefix)} ${number}`)
    }
  }

  return rows
}

function looksLikeChapterTracker(page: KitPage, rows: string[]) {
  const pageText = `${page.title} ${page.subtitle} ${page.section}`.toLowerCase()
  const chapterRows = rows.filter((row) => /\b(chapter|lesson|section)\s+\d+\b/i.test(row)).length

  return chapterRows > 0 || /\b(chapter|lesson|section)\b/.test(pageText)
}

function fillableAttrs(options: {
  kind: "text" | "checkbox"
  suffix: string
  multiline?: boolean
  fontSize?: number
  textColor?: "plum" | "white"
  insetX?: number
  insetY?: number
}) {
  return [
    `data-fillable-kind="${options.kind}"`,
    `data-fillable-suffix="${escapeHtml(options.suffix)}"`,
    options.multiline === undefined ? "" : `data-fillable-multiline="${options.multiline ? "true" : "false"}"`,
    options.fontSize ? `data-fillable-font-size="${options.fontSize}"` : "",
    options.textColor ? `data-fillable-text-color="${options.textColor}"` : "",
    options.insetX ? `data-fillable-inset-x="${options.insetX}"` : "",
    options.insetY ? `data-fillable-inset-y="${options.insetY}"` : "",
  ]
    .filter(Boolean)
    .join(" ")
}

function renderToc(page: KitPage, kit: ParsedKit) {
  const { mainRows, backMatterRows } = tableOfContentsRows(page, kit)

  return `${renderTocRowGroup(mainRows, "toc-list")}${renderTocRowGroup(
    backMatterRows,
    "toc-list toc-backmatter"
  )}`
}

function renderTocRowGroup(rows: TocRow[], className: string) {
  if (rows.length === 0) {
    return ""
  }

  return `<div class="${className}">${rows
    .map(
      (row) =>
        `<div class="toc-row"><span class="toc-number">${escapeHtml(row.number)}</span><span class="toc-section-title">${escapeHtml(
          row.title
        )}</span><span class="toc-leader"></span><span class="toc-page-number">${escapeHtml(
          row.pageNumber
        )}</span></div>`
    )
    .join("")}</div>`
}

type TocRow = {
  number: string
  title: string
  pageNumber: string
  backMatter: boolean
}

function tableOfContentsRows(page: KitPage, kit: ParsedKit) {
  const items = page.content.flatMap((block) => (block.type === "list" ? block.items : []))
  const pageNumbers = tableOfContentsPageNumbers(kit)
  const rows = items.map((item) => parseTocRow(item, pageNumbers))

  return {
    mainRows: rows.filter((row) => !row.backMatter),
    backMatterRows: rows.filter((row) => row.backMatter),
  }
}

function parseTocRow(item: string, pageNumbers: Map<string, string>): TocRow {
  const parts = item.split("|").map((part) => part.trim()).filter(Boolean)
  const hasNumber = parts.length >= 3 || /^\d+\.?$/.test(parts[0] ?? "")
  const number = hasNumber ? (parts[0] ?? "").replace(/\.$/, "") : ""
  const title = hasNumber ? parts[1] ?? item : parts[0] ?? item
  const explicitPage = hasNumber ? parts[2] : parts[1]
  const pageNumber = explicitPage || pageNumbers.get(normaliseTocTitle(title)) || ""

  return {
    number,
    title,
    pageNumber,
    backMatter: !number || /^(resources?|notes?|appendix|references?)$/i.test(title.trim()),
  }
}

function tableOfContentsPageNumbers(kit: ParsedKit) {
  const pageNumbers = new Map<string, string>()

  kit.pages.forEach((page, index) => {
    if (!page.title || page.type === "toc") {
      return
    }

    const key = normaliseTocTitle(page.title)

    if (!pageNumbers.has(key)) {
      pageNumbers.set(key, String(index + 1))
    }
  })

  return pageNumbers
}

function normaliseTocTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(chapter|lesson|section)\s+\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function renderCaseStudy(page: KitPage) {
  return `${page.story ? `<div class="story-box"><div class="key-term-label">${escapeHtml(
    page.storyLabel || "Story"
  )}</div><p>${escapeHtml(page.story)}</p></div>` : ""}${
    page.takeaway ? `<div class="takeaway-box">${escapeHtml(page.takeaway)}</div>` : ""
  }`
}

function renderDecor() {
  return `<div class="decor">
    <span class="dots"></span>
    <span class="swoop"></span>
    <span class="watercolor wash-a"></span>
    <span class="watercolor wash-b"></span>
    <span class="mountain-mark"></span>
    <span class="tool-mark"></span>
    <span class="road-mark"></span>
    <span class="floral floral-left"></span>
    <span class="floral floral-right"></span>
    <span class="spark-lines"></span>
    <span class="brand-arc"></span>
    <span class="brand-cup"></span>
    <span class="brand-card"></span>
    <span class="brand-laptop"></span>
    <span class="brand-plant"></span>
    <span class="brand-door"></span>
    <span class="brand-book"></span>
    <span class="brand-light"></span>
    <span class="brand-pen"></span>
    <span class="brand-glasses"></span>
    <span class="rise-glass"></span>
    <span class="rise-cake"></span>
    <span class="rise-crown"></span>
    <span class="land-compass"></span>
    <span class="land-wrench"></span>
    <span class="land-leaf"></span>
    <span class="rebuild-boxes"></span>
    <span class="rebuild-paint"></span>
    <span class="rebuild-frame"></span>
    <span class="heal-heart"></span>
    <span class="heal-journals"></span>
    <span class="heal-sun"></span>
  </div>`
}

function presetClassName(preset: DesignPresetTokens) {
  return `style-${preset.styleFamily} motif-${preset.motif}`
}

function footer(index: number, total: number, branch: BranchInfo) {
  return `<div class="footer"><span>${escapeHtml(branch.footer)}</span><span>${index + 1} / ${total}</span></div>`
}

function renderIcon(tokens: DesignPresetTokens) {
  if (tokens.icon === "heart") {
    return "&#9825;"
  }

  if (tokens.icon === "crown") {
    return "BC"
  }

  if (tokens.icon === "mountain") {
    return "/\\"
  }

  if (tokens.icon === "sunrise") {
    return "BC"
  }

  return "BC"
}

function titleFromType(type: string) {
  return type
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function cleanCoverKitTitle(title: string) {
  return title.replace(/\s+kit$/i, "").trim()
}

function productLabel(productType: string, outputMode: string | undefined, target: RenderTarget) {
  if (target === "guide") {
    return "Lesson Guide"
  }

  if (target === "workbook") {
    return "Workbook"
  }

  if (outputMode === "split") {
    return "Lesson Guide + Workbook"
  }

  return (productType || "workbook")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function coverProductLabel(kit: ParsedKit, preset: DesignPresetTokens, target: RenderTarget) {
  if (target === "guide") {
    return preset.slug === "meetatheal" ? "Lesson Book" : "Lesson Guide"
  }

  if (target === "workbook") {
    if (preset.slug === "meetatheal") {
      return /couples\s+workbook/i.test(kit.title) ? "Couples Workbook" : "Workbook"
    }

    if (preset.slug === "meetatheal-rise") {
      return "Rise Individual Workbook"
    }

    if (preset.slug === "meetatheal-land") {
      return "Land Individual Workbook"
    }

    return "Workbook"
  }

  if (preset.styleFamily === "brand") {
    return "Lesson Guide + Workbook"
  }

  if (preset.slug === "meetatheal") {
    if (/lesson\s+book/i.test(kit.title)) {
      return "Lesson Book"
    }

    if (/couples\s+workbook/i.test(kit.title)) {
      return "Couples Workbook"
    }
  }

  if (preset.slug === "meetatheal-rise") {
    return "Rise Individual Workbook"
  }

  if (preset.slug === "meetatheal-land") {
    return "Land Individual Workbook"
  }

  return productLabel(kit.productType, kit.outputMode, target)
}

function transparent(hex: string, alpha: number) {
  const trimmed = hex.replace("#", "")
  const red = parseInt(trimmed.slice(0, 2), 16)
  const green = parseInt(trimmed.slice(2, 4), 16)
  const blue = parseInt(trimmed.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function buildAssetDataUri(relativePath: string) {
  const filePath = path.join(/*turbopackIgnore: true*/ process.cwd(), relativePath)

  if (!fs.existsSync(filePath)) {
    return ""
  }

  const extension = path.extname(filePath).toLowerCase()
  const mimeType = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "image/png"
  const data = fs.readFileSync(filePath).toString("base64")

  return `data:${mimeType};base64,${data}`
}

function buildCoverAssetDataUri(tokens: DesignPresetTokens) {
  const fileName = coverAssetFileName(tokens)

  return fileName ? buildAssetDataUri(`public/kit-assets/${fileName}`) : ""
}

function coverAssetFileName(tokens: DesignPresetTokens) {
  if (tokens.slug === "brand") {
    return "brand-cover-bg.png"
  }

  if (tokens.slug === "brand-land") {
    return "brand-land-cover-bg.png"
  }

  if (tokens.styleFamily === "rise") {
    return "rise-cover-bg.png"
  }

  if (tokens.styleFamily === "land") {
    return "land-cover-bg.png"
  }

  if (tokens.styleFamily === "rebuild") {
    return "rebuild-cover-bg.png"
  }

  if (tokens.styleFamily === "meetatheal") {
    return "meetatheal-cover-bg-v2.png"
  }

  return ""
}

function escapeHtml(value: string) {
  return buyerFacingText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function buyerFacingText(value: string) {
  return value
    .replace(/Testing Notes:\s*Verify checkbox spacing\.?/gi, "Notes")
    .replace(/Review before exporting\.?/gi, "Review your notes before moving on.")
    .replace(/Built for testing Kit Factory layouts\.?/gi, "")
    .replace(/Verify checkbox spacing(?:\s+and\s+historical facts)?\s+before sale\.?/gi, "Use trusted sources and verify important facts before finalizing.")
    .replace(/Verify historical facts[^\n.]*/gi, "Use trusted sources to check important facts")
    .replace(/\s+/g, " ")
    .trim()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
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
      const filePath = path.join(/*turbopackIgnore: true*/ process.cwd(), "node_modules", "@fontsource", file)
      const data = fs.readFileSync(filePath).toString("base64")

      return `@font-face { font-family: "${family}"; font-weight: ${weight}; font-style: ${style}; font-display: swap; src: url(data:font/woff2;base64,${data}) format("woff2"); }`
    })
    .join("\n")
}
