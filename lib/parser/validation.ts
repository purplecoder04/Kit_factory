import {
  fillablePageTypes,
  isBranch,
  isDesignPreset,
  isOutputMode,
  isPageType,
  isProductType,
  type ContentBlock,
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

  if (kit.designPreset && !isDesignPreset(kit.designPreset)) {
    issues.push(
      error(
        "invalid-design-preset",
        "Use one of the approved design_preset values.",
        kit.designPreset
      )
    )
  }

  if (!kit.productType) {
    issues.push(
      warning(
        "missing-product-type",
        "product_type is missing, so the app will treat this as a workbook."
      )
    )
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
    issues.push(
      warning(
        "missing-output-mode",
        "output_mode is missing, so the app will use split output."
      )
    )
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

  if (kit.pages.length > 0 && kit.pages[0]?.type !== "cover") {
    issues.push(
      error(
        "missing-cover-first",
        "The first PAGE tag must be cover.",
        "Start the kit with <!-- PAGE: cover -->."
      )
    )
  }

  if (kit.pages.length > 0 && kit.pages.at(-1)?.type !== "closing") {
    issues.push(
      error(
        "missing-closing-last",
        "The last PAGE tag must be closing.",
        "End the kit with <!-- PAGE: closing -->."
      )
    )
  }

  kit.pages.forEach((page, index) => {
    issues.push(...validatePage(page, index, kit.branch))
  })

  issues.push(...validatePackageQuality(kit))

  return issues
}

export function hasBlockingErrors(issues: ValidationIssue[]) {
  return issues.some((issue) => issue.level === "error")
}

function validatePage(
  page: KitPage,
  index: number,
  branch: string
): ValidationIssue[] {
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

  if (isEmptyPage(page)) {
    issues.push(
      error(
        "empty-page",
        `Page ${pageNumber} is empty. Add a title, body text, or fields.`,
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
        "Use the field tags from Kit Factory Markdown Spec v2.",
        index
      )
    )
  })

  page.parserErrors.forEach((message) => {
    issues.push(error("parser-field-error", `Page ${pageNumber}: ${message}`, undefined, index))
  })

  if (page.prompts.length > 0 && page.type !== "workbook") {
    issues.push(
      error(
        "prompt-on-wrong-page",
        `Page ${pageNumber} uses PROMPT outside a workbook page.`,
        "Use REFLECT for thinking prompts, CHECK for checklist items, or ACTION for action-plan pages.",
        index
      )
    )
  }

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

  if (page.type === "checklist" && page.checks.length === 0) {
    issues.push(
      warning(
        "checklist-without-checks",
        `Checklist page ${pageNumber} has no CHECK items.`,
        undefined,
        index
      )
    )
  }

  if (page.tableHeaders.length > 0 && page.type !== "tracker") {
    issues.push(
      error(
        "table-on-wrong-page",
        `Page ${pageNumber} uses TABLE_HEADERS outside a tracker page.`,
        undefined,
        index
      )
    )
  }

  if (page.type === "tracker" && page.tableHeaders.length === 0) {
    issues.push(
      warning(
        "tracker-without-headers",
        `Tracker page ${pageNumber} has no TABLE_HEADERS field.`,
        undefined,
        index
      )
    )
  }

  if (page.actions.length > 0 && page.type !== "action-plan") {
    issues.push(
      warning(
        "action-on-unexpected-page",
        `Page ${pageNumber} uses ACTION outside an action-plan page.`,
        undefined,
        index
      )
    )
  }

  if (page.reflects.length > 0 && page.type !== "unknown" && fillablePageTypes.has(page.type)) {
    issues.push(
      warning(
        "reflect-on-fillable-page",
        `Page ${pageNumber} uses REFLECT on a fillable page.`,
        "REFLECT will render as a non-fillable thinking prompt.",
        index
      )
    )
  }

  if (
    page.content.some((block) => block.type === "alert") &&
    page.type !== "how-to-use" &&
    page.type !== "important-to-know" &&
    page.type !== "resource"
  ) {
    issues.push(
      warning(
        "alert-outside-how-to-use",
        `Page ${pageNumber} uses ALERT outside a how-to-use page.`,
        "It will still render as a highlighted notice box.",
        index
      )
    )
  }

  if (branch !== "brand" && page.content.some((block) => block.type === "alert" && !block.text.trim())) {
    issues.push(
      warning(
        "pending-alert-copy",
        `Page ${pageNumber} has an empty ALERT field.`,
        "This branch disclaimer can stay pending for now.",
        index
      )
    )
  }

  if (page.type === "workbook" && page.prompts.length > 4) {
    issues.push(
      warning(
        "workbook-many-prompts",
        `Workbook page ${pageNumber} has more than 4 prompts.`,
        "The page may overflow in the PDF.",
        index
      )
    )
  }

  if (page.type === "checklist" && page.checks.length > 12) {
    issues.push(
      warning(
        "checklist-many-checks",
        `Checklist page ${pageNumber} has more than 12 items.`,
        "The page may overflow in the PDF.",
        index
      )
    )
  }

  if (
    !page.title &&
    page.type !== "unknown" &&
    page.type !== "cover" &&
    page.type !== "quote"
  ) {
    issues.push(
      warning(
        "missing-page-title",
        `Page ${pageNumber} has no TITLE field.`,
        undefined,
        index
      )
    )
  }

  const bodyLength = measurePageLength(page)

  if (bodyLength > 2400) {
    issues.push(
      warning(
        "page-likely-too-full",
        `Page ${pageNumber} has a lot of content for one clean PDF page.`,
        "Split this into another PAGE section if the render looks crowded.",
        index
      )
    )
  }

  return issues
}

function isEmptyPage(page: KitPage) {
  return (
    !page.section &&
    !page.title &&
    !page.subtitle &&
    !page.tagline &&
    page.content.length === 0 &&
    page.prompts.length === 0 &&
    page.checks.length === 0 &&
    page.tableHeaders.length === 0 &&
    page.tableRows.length === 0 &&
    page.actions.length === 0 &&
    page.questions.length === 0 &&
    !page.story &&
    !page.takeaway &&
    !page.bottomNote
  )
}

function measurePageLength(page: KitPage) {
  const contentLength = page.content.reduce((count, block) => count + measureBlock(block), 0)

  return (
    contentLength +
    page.prompts.join(" ").length +
    page.checks.join(" ").length +
    page.tableHeaders.join(" ").length +
    page.tableRows.join(" ").length +
    page.actions.join(" ").length +
    page.questions.join(" ").length +
    page.story.length +
    page.takeaway.length +
    page.bottomNote.length
  )
}

function measureBlock(block: ContentBlock) {
  if (block.type === "paragraph") {
    return block.text.length
  }

  if (block.type === "quote") {
    return block.text.length + (block.attribution?.length ?? 0)
  }

  if (block.type === "key-term") {
    return block.term.length + block.text.length
  }

  if (block.type === "alert" || block.type === "reflect") {
    return block.text.length
  }

  return block.items.join(" ").length
}

function validatePackageQuality(kit: ParsedKit): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const fullText = kitPlainText(kit)
  const internalPhrases = findInternalProductionPhrases(fullText)

  if (internalPhrases.length > 0) {
    issues.push(
      warning(
        "internal-production-language",
        "This kit still contains internal testing or production language.",
        `Remove before sale: ${internalPhrases.join(", ")}.`
      )
    )
  }

  const tocHasManualPageNumbers = kit.pages.some(
    (page) =>
      page.type === "toc" &&
      page.content.some(
        (block) =>
          block.type === "list" &&
          block.items.some((item) => item.split("|").map((part) => part.trim()).length >= 3)
      )
  )

  if (tocHasManualPageNumbers) {
    issues.push(
      warning(
        "toc-page-numbers-recalculated",
        "TOC page numbers in the markdown will be recalculated from the final exported PDF page order.",
        "This prevents stale numbers like 1, 5, 9 from shipping in shorter exports."
      )
    )
  }

  issues.push(...validateChapterTrackers(kit))
  issues.push(...validateMeetAtHealContentFit(kit, fullText))

  return issues
}

function validateChapterTrackers(kit: ParsedKit): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const chapterCount = Math.max(
    kit.pages.filter((page) => page.type === "lesson").length,
    kit.pages.filter((page) => page.type === "workbook").length
  )

  if (chapterCount <= 0) {
    return issues
  }

  kit.pages.forEach((page, index) => {
    if (page.type !== "tracker" || !looksLikeChapterTracker(page)) {
      return
    }

    const rowCount = page.tableRows.length

    if (rowCount > 0 && rowCount < chapterCount) {
      issues.push(
        warning(
          "chapter-tracker-incomplete",
          `Tracker page ${index + 1} has ${rowCount} chapter rows, but the kit has ${chapterCount} chapters/workbook pages.`,
          "Missing chapter rows will be added during render, but update the markdown before final sale.",
          index
        )
      )
    }
  })

  return issues
}

function validateMeetAtHealContentFit(kit: ParsedKit, fullText: string): ValidationIssue[] {
  const preset = kit.designPreset.toLowerCase()
  const branch = kit.branch.toLowerCase()

  if (!preset.includes("meetatheal") && branch !== "meetatheal") {
    return []
  }

  const relationshipMatches = fullText.match(
    /\b(couple|couples|relationship|marriage|partner|partners|trust|repair|heal|healing|together|communication|forgiveness|intimacy|choose us|shared future)\b/gi
  )
  const offTopicEducationalSignals = /\b(history of television|television|broadcast|broadcasting|media history)\b/i.test(fullText)

  if ((relationshipMatches?.length ?? 0) >= 3 || !offTopicEducationalSignals) {
    return []
  }

  return [
    warning(
      "meetatheal-content-mismatch",
      "This kit is using Meet at the Heal styling, but the content appears to be about another topic.",
      "Rebrand the product topic or replace the body with true relationship/healing content before sale."
    ),
  ]
}

function findInternalProductionPhrases(text: string) {
  const phrases = [
    "Review before exporting",
    "Testing Notes",
    "Verify checkbox spacing",
    "Built for testing Kit Factory layouts",
  ]

  return phrases.filter((phrase) => text.toLowerCase().includes(phrase.toLowerCase()))
}

function kitPlainText(kit: ParsedKit) {
  return [
    kit.title,
    kit.subtitle,
    kit.tagline,
    kit.slug,
    ...kit.pages.flatMap((page) => [
      page.section,
      page.title,
      page.subtitle,
      page.tagline,
      page.raw,
      page.bottomNote,
      page.noteLabel,
      page.storyLabel,
      page.story,
      page.takeaway,
      ...page.prompts,
      ...page.checks,
      ...page.tableHeaders,
      ...page.tableRows,
      ...page.actions,
      ...page.questions,
      ...page.reflects,
    ]),
  ]
    .join(" ")
    .replace(/\s+/g, " ")
}

function looksLikeChapterTracker(page: KitPage) {
  const pageText = `${page.title} ${page.subtitle} ${page.section}`.toLowerCase()
  const chapterRows = page.tableRows.filter((row) => /\b(chapter|lesson|section)\s+\d+\b/i.test(row)).length

  return chapterRows > 0 || /\b(chapter|lesson|section)\b/.test(pageText)
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

function warning(
  code: string,
  message: string,
  detail?: string,
  pageIndex?: number
): ValidationIssue {
  return {
    level: "warning",
    code,
    message,
    detail,
    pageIndex,
  }
}
