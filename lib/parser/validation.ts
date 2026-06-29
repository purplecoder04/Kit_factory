import {
  isBranch,
  isOutputMode,
  isPageType,
  isProductType,
  type KitPage,
  type ParsedKit,
  type ValidationIssue,
} from "@/lib/parser/pageTypes"

export function validateKit(kit: ParsedKit): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!kit.title) {
    issues.push(error("missing-title", "Add a title in the frontmatter."))
  }

  if (!kit.branch) {
    issues.push(error("missing-branch", "Add a branch in the frontmatter."))
  } else if (!isBranch(kit.branch)) {
    issues.push(
      error("invalid-branch", "Use one of the approved branch slugs.", kit.branch)
    )
  }

  if (!kit.productType) {
    issues.push(error("missing-product-type", "Add a product_type in the frontmatter."))
  } else if (!isProductType(kit.productType)) {
    issues.push(
      error(
        "invalid-product-type",
        "Use one of the approved product_type values.",
        kit.productType
      )
    )
  }

  if (!kit.outputMode) {
    issues.push(error("missing-output-mode", "Add an output_mode in the frontmatter."))
  } else if (!isOutputMode(kit.outputMode)) {
    issues.push(
      error(
        "invalid-output-mode",
        "Use either split or all-in-one for output_mode.",
        kit.outputMode
      )
    )
  }

  if (kit.pages.length === 0) {
    issues.push(error("no-pages", "Add at least one PAGE tag before rendering."))
  }

  kit.pages.forEach((page, index) => {
    issues.push(...validatePage(page, index))
  })

  return issues
}

export function hasBlockingErrors(issues: ValidationIssue[]) {
  return issues.some((issue) => issue.level === "error")
}

function validatePage(page: KitPage, index: number): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const pageNumber = index + 1

  if (!isPageType(page.rawType)) {
    issues.push(
      error(
        "unknown-page-type",
        `Page ${pageNumber} uses an unknown PAGE tag.`,
        page.rawType,
        index
      )
    )
  }

  if (
    !page.section &&
    !page.title &&
    page.content.length === 0 &&
    page.prompts.length === 0 &&
    !page.bottomNote
  ) {
    issues.push(
      error(
        "empty-page",
        `Page ${pageNumber} is empty. Add a title, body text, or prompts.`,
        undefined,
        index
      )
    )
  }

  page.unsupportedFields.forEach((field) => {
    issues.push(
      error(
        "unsupported-field",
        `Page ${pageNumber} has an unsupported field: ${field}.`,
        "Supported fields are SECTION, TITLE, BOTTOM_NOTE, and PROMPT.",
        index
      )
    )
  })

  if (page.type === "workbook" && page.prompts.length === 0) {
    issues.push(
      error(
        "workbook-without-prompts",
        `Workbook page ${pageNumber} needs at least one PROMPT field.`,
        undefined,
        index
      )
    )
  }

  const bodyLength =
    page.content.reduce((count, block) => {
      if (block.type === "paragraph") {
        return count + block.text.length
      }

      return count + block.items.join(" ").length
    }, 0) + page.prompts.join(" ").length

  if (bodyLength > 2400 || page.prompts.length > 8) {
    issues.push(
      error(
        "page-too-full",
        `Page ${pageNumber} has too much content for one clean PDF page.`,
        "Split this page into two PAGE sections.",
        index
      )
    )
  }

  return issues
}

function error(
  code: string,
  message: string,
  detail?: string,
  pageIndex?: number
): ValidationIssue {
  return {
    level: "error",
    code,
    message,
    detail,
    pageIndex,
  }
}
