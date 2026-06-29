export const branches = [
  "umbrella",
  "brand",
  "rise",
  "land",
  "rebuild",
  "meetatheal",
] as const

export const productTypes = [
  "workbook",
  "mini-guide",
  "digital-kit",
  "checklist",
  "template-bundle",
] as const

export const outputModes = ["split", "all-in-one"] as const

export const pageTypes = [
  "cover",
  "how-to-use",
  "important-to-know",
  "lesson",
  "workbook",
  "checklist",
  "tracker",
  "reflection",
  "closing",
] as const

export const fillablePageTypes = new Set<PageType>([
  "workbook",
  "checklist",
  "tracker",
  "reflection",
])

export type BranchSlug = (typeof branches)[number]
export type ProductType = (typeof productTypes)[number]
export type OutputMode = (typeof outputModes)[number]
export type PageType = (typeof pageTypes)[number]

export type ContentBlock =
  | {
      type: "paragraph"
      text: string
    }
  | {
      type: "list"
      items: string[]
    }
  | {
      type: "quote"
      text: string
      attribution?: string
    }
  | {
      type: "key-term"
      term: string
      text: string
    }
  | {
      type: "alert"
      text: string
    }

export type KitPage = {
  id: string
  type: PageType | "unknown"
  rawType: string
  section: string
  title: string
  content: ContentBlock[]
  prompts: string[]
  bottomNote: string
  fillable: boolean
  raw: string
  unsupportedFields: string[]
}

export type ParsedKit = {
  title: string
  branch: BranchSlug | string
  productType: ProductType | string
  outputMode: OutputMode | string
  slug: string
  pages: KitPage[]
}

export type ValidationIssue = {
  level: "error" | "warning"
  code: string
  message: string
  detail?: string
  pageIndex?: number
}

export function isBranch(value: string): value is BranchSlug {
  return branches.includes(value as BranchSlug)
}

export function isProductType(value: string): value is ProductType {
  return productTypes.includes(value as ProductType)
}

export function isOutputMode(value: string): value is OutputMode {
  return outputModes.includes(value as OutputMode)
}

export function isPageType(value: string): value is PageType {
  return pageTypes.includes(value as PageType)
}
