import {
  defaultDesignPresetForBranch,
  isBranch,
  isDesignPreset,
  type BranchSlug,
  type DesignPresetSlug,
} from "@/lib/parser/pageTypes"

export type BranchInfo = {
  slug: BranchSlug
  name: string
  shortName: string
  footer: string
}

export type StyleFamily = "brand" | "rise" | "land" | "rebuild" | "meetatheal" | "umbrella"

export type DesignPresetTokens = {
  slug: DesignPresetSlug
  branch: BranchSlug
  name: string
  shortName: string
  styleFamily: StyleFamily
  description: string
  background: string
  paper: string
  paperAlt: string
  ink: string
  mutedInk: string
  accent: string
  accentSoft: string
  plum: string
  lilac: string
  gold: string
  sage: string
  rose: string
  blue: string
  line: string
  footer: string
  icon: string
  motif: string
}

export type BranchTokens = DesignPresetTokens

export const branchInfo = {
  umbrella: {
    slug: "umbrella",
    name: "Best Collective",
    shortName: "Umbrella",
    footer: "Best Collective LLC",
  },
  brand: {
    slug: "brand",
    name: "Best Collective Brand",
    shortName: "Brand",
    footer: "Best Collective Brand LLC",
  },
  rise: {
    slug: "rise",
    name: "Best Collective Rise",
    shortName: "Rise",
    footer: "Best Collective Rise LLC",
  },
  land: {
    slug: "land",
    name: "Best Collective Land",
    shortName: "Land",
    footer: "Best Collective Land LLC",
  },
  rebuild: {
    slug: "rebuild",
    name: "Best Collective Rebuild",
    shortName: "Rebuild",
    footer: "Best Collective Rebuild LLC",
  },
  meetatheal: {
    slug: "meetatheal",
    name: "Meet at the Heal",
    shortName: "Meet at the Heal",
    footer: "Best Collective | Meet at the Heal",
  },
} satisfies Record<BranchSlug, BranchInfo>

export const designPresetTokens = {
  brand: {
    slug: "brand",
    branch: "brand",
    name: "Brand Signature",
    shortName: "Brand",
    styleFamily: "brand",
    description: "Plum, orchid, gold, editorial business styling.",
    background: "#222026",
    paper: "#FAF5F0",
    paperAlt: "#F4EFE8",
    ink: "#2A1538",
    mutedInk: "#5F4D69",
    accent: "#D4AF37",
    accentSoft: "#ECE5F4",
    plum: "#4F2C68",
    lilac: "#EDE7F3",
    gold: "#D4AF37",
    sage: "#7B9A8B",
    rose: "#9A7B90",
    blue: "#8EA3B7",
    line: "#DED3E6",
    footer: branchInfo.brand.footer,
    icon: "bc",
    motif: "plum-circles",
  },
  "brand-land": {
    slug: "brand-land",
    branch: "brand",
    name: "Brand Land",
    shortName: "Brand Land",
    styleFamily: "brand",
    description: "Brand layout with Land's grounded green masculine palette.",
    background: "#1E2121",
    paper: "#F6F3ED",
    paperAlt: "#D8CEC2",
    ink: "#3E5A45",
    mutedInk: "#8A6B4D",
    accent: "#9CCB7A",
    accentSoft: "#D8CEC2",
    plum: "#3E5A45",
    lilac: "#D8CEC2",
    gold: "#9CCB7A",
    sage: "#8DAE8C",
    rose: "#8A6B4D",
    blue: "#8DAE8C",
    line: "#D8CEC2",
    footer: branchInfo.brand.footer,
    icon: "mountain",
    motif: "grounded-circles",
  },
  rise: {
    slug: "rise",
    branch: "rise",
    name: "Rise",
    shortName: "Rise",
    styleFamily: "rise",
    description: "Rose gold, blush, soft florals, standards and self-trust.",
    background: "#28282E",
    paper: "#FFF7F4",
    paperAlt: "#FBEDEA",
    ink: "#6F2F49",
    mutedInk: "#7C5C67",
    accent: "#E18A82",
    accentSoft: "#F7D6E6",
    plum: "#8F4E67",
    lilac: "#DCC6E3",
    gold: "#C9896D",
    sage: "#96A78F",
    rose: "#C76E82",
    blue: "#88ADCE",
    line: "#E7D6CF",
    footer: branchInfo.rise.footer,
    icon: "crown",
    motif: "rose-ribbons",
  },
  land: {
    slug: "land",
    branch: "land",
    name: "Land",
    shortName: "Land",
    styleFamily: "land",
    description: "Forest green, mountains, tools, topographic foundation styling.",
    background: "#1E2121",
    paper: "#F6F3ED",
    paperAlt: "#D8CEC2",
    ink: "#3E5A45",
    mutedInk: "#8A6B4D",
    accent: "#9CCB7A",
    accentSoft: "#D8CEC2",
    plum: "#3E5A45",
    lilac: "#D8CEC2",
    gold: "#9CCB7A",
    sage: "#8DAE8C",
    rose: "#8A6B4D",
    blue: "#8DAE8C",
    line: "#D8CEC2",
    footer: branchInfo.land.footer,
    icon: "mountain",
    motif: "mountains-tools",
  },
  rebuild: {
    slug: "rebuild",
    branch: "rebuild",
    name: "Rebuild",
    shortName: "Rebuild",
    styleFamily: "rebuild",
    description: "Airy watercolor blue, pink, plants, and new-season styling.",
    background: "#282828",
    paper: "#FAF6EF",
    paperAlt: "#F2EEE8",
    ink: "#315A7E",
    mutedInk: "#626D73",
    accent: "#C88FA1",
    accentSoft: "#EAF0F4",
    plum: "#88ADCE",
    lilac: "#C9B9E7",
    gold: "#B8A76A",
    sage: "#96A78F",
    rose: "#F3C7CE",
    blue: "#88ADCE",
    line: "#D6C7B2",
    footer: branchInfo.rebuild.footer,
    icon: "sunrise",
    motif: "watercolor-rebuild",
  },
  meetatheal: {
    slug: "meetatheal",
    branch: "meetatheal",
    name: "Meet at the Heal",
    shortName: "Meet at the Heal",
    styleFamily: "meetatheal",
    description: "Couples healing with roads, mountains, florals, and hearts.",
    background: "#303D3C",
    paper: "#FAF6F0",
    paperAlt: "#F2EDE7",
    ink: "#405C5A",
    mutedInk: "#6E6D68",
    accent: "#C97A8E",
    accentSoft: "#F2E1E2",
    plum: "#4F2D68",
    lilac: "#E9DFEF",
    gold: "#A0806A",
    sage: "#6F7F63",
    rose: "#C97A8E",
    blue: "#8BA3B7",
    line: "#D8CEC2",
    footer: branchInfo.meetatheal.footer,
    icon: "heart",
    motif: "roads-hearts",
  },
  "meetatheal-rise": {
    slug: "meetatheal-rise",
    branch: "meetatheal",
    name: "Meet at the Heal Rise",
    shortName: "MATH Rise",
    styleFamily: "rise",
    description: "Rise visual styling with Meet at the Heal identity.",
    background: "#28282E",
    paper: "#FFF7F4",
    paperAlt: "#FBEDEA",
    ink: "#6F2F49",
    mutedInk: "#7C5C67",
    accent: "#E18A82",
    accentSoft: "#F7D6E6",
    plum: "#8F4E67",
    lilac: "#DCC6E3",
    gold: "#C9896D",
    sage: "#96A78F",
    rose: "#C76E82",
    blue: "#88ADCE",
    line: "#E7D6CF",
    footer: branchInfo.meetatheal.footer,
    icon: "heart",
    motif: "rose-ribbons",
  },
  "meetatheal-land": {
    slug: "meetatheal-land",
    branch: "meetatheal",
    name: "Meet at the Heal Land",
    shortName: "MATH Land",
    styleFamily: "land",
    description: "Land visual styling with Meet at the Heal identity.",
    background: "#1E2121",
    paper: "#F6F3ED",
    paperAlt: "#D8CEC2",
    ink: "#3E5A45",
    mutedInk: "#8A6B4D",
    accent: "#9CCB7A",
    accentSoft: "#D8CEC2",
    plum: "#3E5A45",
    lilac: "#D8CEC2",
    gold: "#9CCB7A",
    sage: "#8DAE8C",
    rose: "#8A6B4D",
    blue: "#8DAE8C",
    line: "#D8CEC2",
    footer: branchInfo.meetatheal.footer,
    icon: "mountain",
    motif: "mountains-tools",
  },
  umbrella: {
    slug: "umbrella",
    branch: "umbrella",
    name: "Best Collective House",
    shortName: "Umbrella",
    styleFamily: "umbrella",
    description: "House-level neutral Best Collective styling.",
    background: "#211F23",
    paper: "#FAF5ED",
    paperAlt: "#F0EBE4",
    ink: "#2F2638",
    mutedInk: "#665D70",
    accent: "#B6813B",
    accentSoft: "#ECE8EF",
    plum: "#5B3A6D",
    lilac: "#ECE8EF",
    gold: "#B6813B",
    sage: "#7E9487",
    rose: "#9A7B90",
    blue: "#8EA3B7",
    line: "#DED7E4",
    footer: branchInfo.umbrella.footer,
    icon: "bc",
    motif: "house-circles",
  },
} satisfies Record<DesignPresetSlug, DesignPresetTokens>

export const branchOptions = Object.values(branchInfo).map((branch) => ({
  slug: branch.slug,
  name: branch.shortName,
}))

export const designPresetOptions = Object.values(designPresetTokens).map((preset) => ({
  slug: preset.slug,
  name: preset.name,
  branch: preset.branch,
  description: preset.description,
}))

export const branchTokenOptions = designPresetOptions

export function getBranchInfo(branch?: string): BranchInfo {
  return branch && isBranch(branch) ? branchInfo[branch] : branchInfo.brand
}

export function getDesignPreset(
  designPreset?: string,
  branch?: string
): DesignPresetTokens {
  if (designPreset && isDesignPreset(designPreset)) {
    return designPresetTokens[designPreset]
  }

  return designPresetTokens[defaultDesignPresetForBranch(branch ?? "brand")]
}

export function getBranchTokens(branch?: string): DesignPresetTokens {
  return getDesignPreset(undefined, branch)
}
