import "server-only"

import { type KitPage, type ParsedKit } from "@/lib/parser/pageTypes"
import { type RenderTarget, selectPagesForTarget } from "@/lib/renderer"

export type FieldSpec = {
  pageIndex: number
  name: string
  kind: "text" | "checkbox"
  x: number
  y: number
  width: number
  height: number
  multiline?: boolean
  fontSize?: number
  textColor?: "plum" | "white"
}

const pageHeight = 792
const promptFieldLeft = 56
const promptFieldTop = 158
const promptFieldGap = 108
const promptFieldWidth = 502
const promptFieldHeight = 55
const checkboxLeft = 44
const checklistTop = 145
const checklistGap = 29
const checkboxSize = 12

export function mapFillableFields(kit: ParsedKit, target: RenderTarget): FieldSpec[] {
  const selectedKit = selectPagesForTarget(kit, target)
  const specs: FieldSpec[] = []

  selectedKit.pages.forEach((page, pageIndex) => {
    if (!page.fillable) {
      return
    }

    specs.push(...mapPageFields(kit.slug, page, pageIndex))
  })

  return specs
}

function mapPageFields(slug: string, page: KitPage, pageIndex: number): FieldSpec[] {
  if (page.type === "workbook") {
    return mapWorkbookFields(slug, page, pageIndex)
  }

  if (page.type === "checklist") {
    return mapChecklistFields(slug, page, pageIndex)
  }

  if (page.type === "tracker") {
    return mapTrackerFields(slug, page, pageIndex)
  }

  if (page.type === "action-plan") {
    return mapActionFields(slug, page, pageIndex)
  }

  if (page.type === "notes") {
    return [
      textField(slug, pageIndex, "notes_01", 56, 148, 502, 480, {
        multiline: true,
      }),
    ]
  }

  return []
}

function mapWorkbookFields(slug: string, page: KitPage, pageIndex: number): FieldSpec[] {
  return page.prompts.slice(0, 4).map((_, index) =>
    textField(
      slug,
      pageIndex,
      `prompt_${String(index + 1).padStart(2, "0")}`,
      promptFieldLeft,
      promptFieldTop + index * promptFieldGap,
      promptFieldWidth,
      promptFieldHeight,
      { multiline: true }
    )
  )
}

function mapChecklistFields(slug: string, page: KitPage, pageIndex: number): FieldSpec[] {
  const items = page.checks.length > 0 ? page.checks : ["check"]
  const fields: FieldSpec[] = items.slice(0, 12).map((_, index) => ({
    pageIndex,
    name: fieldName(slug, pageIndex, `check_${String(index + 1).padStart(2, "0")}`),
    kind: "checkbox" as const,
    x: checkboxLeft,
    y: topToY(checklistTop + index * checklistGap, checkboxSize),
    width: checkboxSize,
    height: checkboxSize,
  }))

  if (page.noteLabel) {
    fields.push(
      textField(slug, pageIndex, "notes_01", 56, 610, 502, 58, {
        multiline: true,
        fontSize: 9.5,
      })
    )
  }

  return fields
}

function mapTrackerFields(slug: string, page: KitPage, pageIndex: number): FieldSpec[] {
  const headers = page.tableHeaders.length > 0 ? page.tableHeaders : ["Category", "Goal", "Actual", "Notes"]
  const rows = page.tableRows.length > 0 ? page.tableRows : ["Revenue", "Expenses", "Profit", "Notes"]
  const columnCount = Math.max(headers.length, 2)
  const tableLeft = 56
  const tableTop = 150
  const tableWidth = 502
  const rowHeight = 33
  const colWidth = tableWidth / columnCount

  return rows.slice(0, 10).flatMap((_, row) =>
    headers.slice(1).map((__, columnIndex) =>
      textField(
        slug,
        pageIndex,
        `table_row${String(row + 1).padStart(2, "0")}_col${String(columnIndex + 2).padStart(2, "0")}`,
        tableLeft + colWidth * (columnIndex + 1) + 4,
        tableTop + 31 + row * rowHeight,
        colWidth - 8,
        rowHeight - 5,
        {
          multiline: columnIndex === headers.length - 2,
          fontSize: 8.5,
        }
      )
    )
  )
}

function mapActionFields(slug: string, page: KitPage, pageIndex: number): FieldSpec[] {
  const actions = page.actions.length > 0 ? page.actions : ["action"]
  const actionFields = actions.slice(0, 4).map((_, index) =>
    textField(slug, pageIndex, `action_${String(index + 1).padStart(2, "0")}`, 86, 158 + index * 100, 472, 48, {
      multiline: true,
    })
  )

  const questionFields = page.questions.slice(0, 3).map((_, index) =>
    textField(slug, pageIndex, `question_${String(index + 1).padStart(2, "0")}`, 56, 570 + index * 44, 502, 30, {
      multiline: true,
      fontSize: 9.5,
    })
  )

  return [...actionFields, ...questionFields]
}

function textField(
  slug: string,
  pageIndex: number,
  suffix: string,
  x: number,
  top: number,
  width: number,
  height: number,
  options: Pick<FieldSpec, "multiline" | "fontSize" | "textColor"> = {}
): FieldSpec {
  return {
    pageIndex,
    name: fieldName(slug, pageIndex, suffix),
    kind: "text",
    x,
    y: topToY(top, height),
    width,
    height,
    fontSize: options.fontSize ?? 10,
    multiline: options.multiline,
    textColor: options.textColor,
  }
}

function fieldName(slug: string, pageIndex: number, suffix: string) {
  const pageNum = String(pageIndex + 1).padStart(3, "0")

  return `${slug}_${pageNum}_${suffix}`
}

function topToY(top: number, height: number) {
  return pageHeight - top - height
}
