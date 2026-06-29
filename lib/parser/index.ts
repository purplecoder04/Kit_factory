import matter from "gray-matter"

import {
  fillablePageTypes,
  isPageType,
  type BranchSlug,
  type ContentBlock,
  type KitPage,
  type OutputMode,
  type ParsedKit,
} from "@/lib/parser/pageTypes"

type ParseOptions = {
  branch?: BranchSlug
  outputMode?: OutputMode
}

const supportedFields = new Set([
  "SECTION",
  "TITLE",
  "BOTTOM_NOTE",
  "PROMPT",
  "QUOTE",
  "QUOTE_BY",
  "KEY_TERM",
  "KEY_TERM_BODY",
  "ALERT",
])
const pageTagPattern = /<!--\s*PAGE:\s*([a-zA-Z0-9-]+)\s*-->/g

export function parseKitMarkdown(
  markdown: string,
  options: ParseOptions = {}
): ParsedKit {
  const parsed = matter(markdown)
  const data = parsed.data ?? {}
  const title = stringValue(data.title)
  const branch = options.branch ?? normaliseSlug(stringValue(data.branch))
  const outputMode =
    options.outputMode ?? normaliseSlug(stringValue(data.output_mode))
  const productType = normaliseSlug(stringValue(data.product_type))

  return {
    title,
    branch,
    productType,
    outputMode,
    slug: slugify(title || "untitled-kit"),
    pages: parsePages(parsed.content),
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
      index + 1 < matches.length ? matches[index + 1].index ?? content.length : content.length
    const raw = content.slice(start, end).trim()
    const parsedType = isPageType(rawType) ? rawType : "unknown"
    const page = parsePageBody(raw)

    return {
      id: `page-${index + 1}`,
      type: parsedType,
      rawType,
      section: page.section,
      title: page.title,
      content: page.content,
      prompts: page.prompts,
      bottomNote: page.bottomNote,
      fillable: parsedType !== "unknown" && fillablePageTypes.has(parsedType),
      raw,
      unsupportedFields: page.unsupportedFields,
    }
  })
}

function parsePageBody(raw: string) {
  const bodyLines: string[] = []
  const content: ContentBlock[] = []
  const prompts: string[] = []
  const unsupportedFields: string[] = []
  let section = ""
  let title = ""
  let bottomNote = ""

  const flushBodyLines = () => {
    if (bodyLines.length === 0) {
      return
    }

    content.push(...parseContentBlocks(bodyLines))
    bodyLines.length = 0
  }

  const pushContentBlock = (block: ContentBlock) => {
    flushBodyLines()
    content.push(block)
  }

  for (const line of raw.split(/\r?\n/)) {
    const field = line.match(/^([A-Z_]+):\s*(.*)$/)

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

    if (key === "BOTTOM_NOTE") {
      bottomNote = value
    }

    if (key === "PROMPT") {
      prompts.push(value)
    }

    if (key === "QUOTE") {
      pushContentBlock({ type: "quote", text: value })
    }

    if (key === "QUOTE_BY") {
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
        content.push({ type: "key-term", term: "Key Term", text: value })
      }
    }

    if (key === "ALERT") {
      pushContentBlock({ type: "alert", text: value })
    }
  }

  flushBodyLines()

  return {
    section,
    title,
    content,
    prompts,
    bottomNote,
    unsupportedFields,
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

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normaliseSlug(value: string) {
  return value.trim().toLowerCase()
}
