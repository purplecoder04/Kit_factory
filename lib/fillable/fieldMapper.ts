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
  const pageNum = String(pageIndex + 1).padStart(3, "0")

  if (page.type === "checklist") {
    const prompts = page.prompts.length > 0 ? page.prompts : ["check"]

    return prompts.slice(0, 8).map((_, index) => ({
      pageIndex,
      name: `${slug}_${pageNum}_check_${String(index + 1).padStart(2, "0")}`,
      kind: "checkbox",
      x: 52,
      y: topToY(130 + index * 53, 14),
      width: 14,
      height: 14,
    }))
  }

  if (page.type === "tracker") {
    const columns = [
      { key: "step", x: 52, width: 104 },
      { key: "owner", x: 156, width: 137 },
      { key: "status", x: 293, width: 141 },
      { key: "notes", x: 434, width: 126 },
    ]

    return Array.from({ length: 3 }).flatMap((_, row) =>
      columns.map((column) => ({
        pageIndex,
        name: `${slug}_${pageNum}_row_${row + 1}_${column.key}`,
        kind: "text" as const,
        x: column.x + 5,
        y: topToY(149 + row * 31.5, 30),
        width: column.width - 10,
        height: 28,
        fontSize: 8.5,
        multiline: column.key === "notes",
      }))
    )
  }

  if (page.type === "reflection") {
    return page.prompts.slice(0, 2).map((_, index) => ({
      pageIndex,
      name: `${slug}_${pageNum}_reflection_${String(index + 1).padStart(2, "0")}`,
      kind: "text",
      x: 52,
      y: topToY(146 + index * 185, 146),
      width: 508,
      height: 146,
      fontSize: 10.5,
      textColor: "white",
      multiline: true,
    }))
  }

  return page.prompts.slice(0, 4).map((_, index) => ({
    pageIndex,
    name: `${slug}_${pageNum}_field_${String(index + 1).padStart(2, "0")}`,
    kind: "text",
    x: 66,
    y: topToY(157 + index * 106, 46),
    width: 480,
    height: 46,
    fontSize: 10.5,
    multiline: true,
  }))
}

function topToY(top: number, height: number) {
  return pageHeight - top - height
}
