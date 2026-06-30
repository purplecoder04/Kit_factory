import matter from "gray-matter"

import {
  defaultDesignPresetForBranch,
  fillablePageTypes,
  isPageType,
  type ContentBlock,
  type KitPage,
  type OutputMode,
  type ParsedKit,
} from "@/lib/parser/pageTypes"

type ParseOptions = {
  branch?: string
  designPreset?: string
  outputMode?: OutputMode
}

const supportedFields = new Set([
  "SECTION",
  "TITLE",
  "SUBTITLE",
  "TAGLINE",
  "BOTTOM_NOTE",
  "PROMPT",
  "CHECK",
  "QUOTE",
  "QUOTE_BY",
  "ATTRIBUTION",
  "KEY_TERM",
  "KEY_TERM_BODY",
  "ALERT",
  "NOTE_LABEL",
  "TABLE_HEADERS",
  "TABLE_ROWS",
  "ACTION",
  "QUESTION",
  "STORY_LABEL",
  "STORY",
  "TAKEAWAY",
  "IMAGE_SLOT",
  "ICON",
  "REFLECT",
])

const pageTagPattern = /<!--\s*PAGE:\s*([a-zA-Z0-9-]+)\s*-->/g
const fieldPattern = /^([A-Z_]+):\s*(.*)$/

export const brandAlertFallback = `This kit is written mainly for U.S.-based businesses. Some steps reference IRS.gov, state filing portals, city or county licenses, state tax registration, FinCEN.gov, and other U.S.-specific setup details.

If you are outside the U.S., some steps may not apply the same way. Use the parts that fit, and check your own local rules before making important business decisions.

This kit is educational. It helps you understand the foundation. It does not replace legal, tax, insurance, accounting, or financial advice. When a decision affects taxes, liability, licensing, compliance, money, customer data, or risk, verify the information through an official source or a qualified professional.

Even within the U.S., state rules vary. Always verify state-specific filing, tax, and licensing requirements through your state's official website or a qualified professional in your area.`

export function parseKitMarkdown(
  markdown: string,
  options: ParseOptions = {}
): ParsedKit {
  const parsed = matter(markdown)
  const data = parsed.data ?? {}
  const title = stringValue(data.title)
  const branch = normaliseSlug(options.branch ?? stringValue(data.branch))
  const designPreset =
    normaliseSlug(options.designPreset ?? stringValue(data.design_preset)) ||
    defaultDesignPresetForBranch(branch)
  const outputMode =
    options.outputMode ?? normaliseSlug(stringValue(data.output_mode))
  const productType = normaliseSlug(stringValue(data.product_type))
  const explicitSlug = normaliseSlug(stringValue(data.slug))

  return {
    title,
    subtitle: stringValue(data.subtitle),
    branch,
    designPreset,
    productType,
    outputMode,
    author: stringValue(data.author) || "Best Collective",
    tagline: stringValue(data.tagline),
    slug: explicitSlug || slugify(title || "untitled-kit"),
    pages: applyBranchFallbacks(parsePages(parsed.content), branch),
  }
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parsePages(content: string): KitPage[] {
  const matches = [...content.matchAll(pageTagPattern)]

  return matches.map((match, index) => {
    const rawType = normaliseSlug(match[1] ?? "")
    const start = (match.index ?? 0) + match[0].length
    const end =
      index + 1 < matches.length
        ? matches[index + 1].index ?? content.length
        : content.length
    const raw = content.slice(start, end).trim()
    const parsedType = isPageType(rawType) ? rawType : "unknown"
    const page = parsePageBody(raw, parsedType)

    return {
      id: `page-${index + 1}`,
      type: parsedType,
      rawType,
      section: page.section,
      title: page.title,
      subtitle: page.subtitle,
      tagline: page.tagline,
      content: page.content,
      prompts: page.prompts,
      checks: page.checks,
      noteLabel: page.noteLabel,
      tableHeaders: page.tableHeaders,
      tableRows: page.tableRows,
      actions: page.actions,
      questions: page.questions,
      storyLabel: page.storyLabel,
      story: page.story,
      takeaway: page.takeaway,
      imageSlot: page.imageSlot,
      icon: page.icon,
      reflects: page.reflects,
      bottomNote: page.bottomNote,
      fillable: parsedType !== "unknown" && fillablePageTypes.has(parsedType),
      raw,
      unsupportedFields: page.unsupportedFields,
      parserErrors: page.parserErrors,
      parserWarnings: page.parserWarnings,
    }
  })
}

function parsePageBody(raw: string, pageType: KitPage["type"]) {
  const bodyLines: string[] = []
  const content: ContentBlock[] = []
  const prompts: string[] = []
  const checks: string[] = []
  const tableHeaders: string[] = []
  const tableRows: string[] = []
  const actions: string[] = []
  const questions: string[] = []
  const reflects: string[] = []
  const unsupportedFields: string[] = []
  const parserErrors: string[] = []
  const parserWarnings: string[] = []
  let section = ""
  let title = ""
  let subtitle = ""
  let tagline = ""
  let bottomNote = ""
  let noteLabel = ""
  let storyLabel = ""
  let story = ""
  let takeaway = ""
  let imageSlot = ""
  let icon = ""

  const flushBodyLines = () => {
    if (bodyLines.length === 0) {
      return
    }

    if (pageType === "toc") {
      content.push({
        type: "list",
        items: bodyLines.map((line) => line.trim()).filter(Boolean),
      })
    } else {
      content.push(...parseContentBlocks(bodyLines))
    }

    bodyLines.length = 0
  }

  const pushContentBlock = (block: ContentBlock) => {
    flushBodyLines()
    content.push(block)
  }

  const pushCheck = (value: string) => {
    if (pageType === "checklist") {
      checks.push(value)
      return
    }

    flushBodyLines()
    const lastBlock = content.at(-1)

    if (lastBlock?.type === "check-list") {
      lastBlock.items.push(value)
    } else {
      content.push({ type: "check-list", items: [value] })
    }
  }

  const lines = raw.split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const field = line.match(fieldPattern)

    if (!field) {
      bodyLines.push(line)
      continue
    }

    const key = field[1]
    const value = field[2].trim()

    if (!supportedFields.has(key)) {
      unsupportedFields.push(key)
      continue
    }

    if (key === "SECTION") {
      section = value
    }

    if (key === "TITLE") {
      title = value
    }

    if (key === "SUBTITLE") {
      subtitle = value
    }

    if (key === "TAGLINE") {
      tagline = value
    }

    if (key === "BOTTOM_NOTE") {
      bottomNote = value
    }

    if (key === "PROMPT") {
      prompts.push(value)
    }

    if (key === "CHECK") {
      pushCheck(value)
    }

    if (key === "QUOTE") {
      pushContentBlock({ type: "quote", text: value })
    }

    if (key === "QUOTE_BY" || key === "ATTRIBUTION") {
      flushBodyLines()
      const lastBlock = content.at(-1)

      if (lastBlock?.type === "quote") {
        lastBlock.attribution = value
      }
    }

    if (key === "KEY_TERM") {
      pushContentBlock({ type: "key-term", term: value, text: "" })
    }

    if (key === "KEY_TERM_BODY") {
      flushBodyLines()
      const lastBlock = content.at(-1)

      if (lastBlock?.type === "key-term") {
        lastBlock.text = value
      } else {
        parserErrors.push("KEY_TERM_BODY must appear after KEY_TERM.")
      }
    }

    if (key === "ALERT") {
      pushContentBlock({ type: "alert", text: value })
    }

    if (key === "REFLECT") {
      reflects.push(value)
      pushContentBlock({ type: "reflect", text: value })
    }

    if (key === "NOTE_LABEL") {
      noteLabel = value
    }

    if (key === "TABLE_HEADERS") {
      tableHeaders.push(...splitPipes(value))
    }

    if (key === "TABLE_ROWS") {
      const rows = value ? [value] : []

      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1]
        const nextTrimmed = nextLine.trim()

        if (nextTrimmed && nextLine.match(fieldPattern)) {
          break
        }

        index += 1

        if (nextTrimmed) {
          rows.push(nextTrimmed)
        }
      }

      tableRows.push(...rows)
    }

    if (key === "ACTION") {
      actions.push(value)
    }

    if (key === "QUESTION") {
      questions.push(value)
    }

    if (key === "STORY_LABEL") {
      storyLabel = value
    }

    if (key === "STORY") {
      story = value
    }

    if (key === "TAKEAWAY") {
      takeaway = value
    }

    if (key === "IMAGE_SLOT") {
      imageSlot = value
    }

    if (key === "ICON") {
      icon = value
    }
  }

  flushBodyLines()

  return {
    section,
    title,
    subtitle,
    tagline,
    content,
    prompts,
    checks,
    noteLabel,
    tableHeaders,
    tableRows,
    actions,
    questions,
    storyLabel,
    story,
    takeaway,
    imageSlot,
    icon,
    reflects,
    bottomNote,
    unsupportedFields,
    parserErrors,
    parserWarnings,
  }
}

function parseContentBlocks(lines: string[]): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const paragraph: string[] = []
  let list: string[] = []

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return
    }

    blocks.push({
      type: "paragraph",
      text: paragraph.join(" ").replace(/\s+/g, " ").trim(),
    })
    paragraph.length = 0
  }

  const flushList = () => {
    if (list.length === 0) {
      return
    }

    blocks.push({
      type: "list",
      items: list,
    })
    list = []
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }

    const listMatch = trimmed.match(/^[-*]\s+(.*)$/)

    if (listMatch) {
      flushParagraph()
      list.push(listMatch[1].trim())
      continue
    }

    flushList()
    paragraph.push(trimmed.replace(/^#{1,6}\s+/, ""))
  }

  flushParagraph()
  flushList()

  return blocks
}

function applyBranchFallbacks(pages: KitPage[], branch: string) {
  if (branch !== "brand") {
    return pages
  }

  return pages.map((page) => ({
    ...page,
    content: page.content.map((block) =>
      block.type === "alert" && !block.text.trim()
        ? { ...block, text: brandAlertFallback }
        : block
    ),
  }))
}

function splitPipes(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normaliseSlug(value: string) {
  return value.trim().toLowerCase()
}
