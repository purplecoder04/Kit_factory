export const branches = [
  "umbrella",
  "brand",
  "rise",
  "land",
  "rebuild",
  "meetatheal",
] as const

export const designPresets = [
  "brand",
  "brand-land",
  "rise",
  "land",
  "rebuild",
  "meetatheal",
  "meetatheal-rise",
  "meetatheal-land",
  "umbrella",
] as const

export const defaultDesignPresetByBranch = {
  umbrella: "umbrella",
  brand: "brand",
  rise: "rise",
  land: "land",
  rebuild: "rebuild",
  meetatheal: "meetatheal",
} satisfies Record<BranchSlug, DesignPresetSlug>

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
  "welcome",
  "toc",
  "quote",
  "section-divider",
  "how-to-use",
  "important-to-know",
  "lesson",
  "lesson-continue",
  "workbook",
  "checklist",
  "tracker",
  "action-plan",
  "notes",
  "reflection",
  "progress-check",
  "resource",
  "case-study",
  "closing",
] as const

export const fillablePageTypes = new Set<PageType>([
  "workbook",
  "checklist",
  "tracker",
  "action-plan",
  "notes",
])

export type BranchSlug = (typeof branches)[number]
export type DesignPresetSlug = (typeof designPresets)[number]
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
      type: "check-list"
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
  | {
      type: "reflect"
      text: string
    }

export type KitPage = {
  id: string
  type: PageType | "unknown"
  rawType: string
  section: string
  title: string
  subtitle: string
  tagline: string
  content: ContentBlock[]
  prompts: string[]
  checks: string[]
  noteLabel: string
  tableHeaders: string[]
  tableRows: string[]
  actions: string[]
  questions: string[]
  storyLabel: string
  story: string
  takeaway: string
  imageSlot: string
  icon: string
  reflects: string[]
  bottomNote: string
  fillable: boolean
  raw: string
  unsupportedFields: string[]
  parserErrors: string[]
  parserWarnings: string[]
}

export type ParsedKit = {
  title: string
  subtitle: string
  branch: BranchSlug | string
  designPreset: DesignPresetSlug | string
  productType: ProductType | string
  outputMode: OutputMode | string
  author: string
  tagline: string
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

export function isDesignPreset(value: string): value is DesignPresetSlug {
  return designPresets.includes(value as DesignPresetSlug)
}

export function defaultDesignPresetForBranch(branch: string): DesignPresetSlug {
  return isBranch(branch) ? defaultDesignPresetByBranch[branch] : "brand"
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
