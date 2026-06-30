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
    paper: "#FAF6F0",
    paperAlt: "#D8CEC2",
    ink: "#4F2D68",
    mutedInk: "#9A7BB0",
    accent: "#D4AF37",
    accentSoft: "#D8CEC2",
    plum: "#4F2D68",
    lilac: "#9A7BB0",
    gold: "#D4AF37",
    sage: "#D8CEC2",
    rose: "#9A7BB0",
    blue: "#9A7BB0",
    line: "#D8CEC2",
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
    accent: "#BDB369",
    accentSoft: "#D8CEC2",
    plum: "#3E5A45",
    lilac: "#D8CEC2",
    gold: "#BDB369",
    sage: "#8DAE8C",
    rose: "#8A6B4D",
    blue: "#8DAE8C",
    line: "#D8CEC2",
    footer: branchInfo.brand.footer,
    icon: "bc",
    motif: "grounded-circles",
  },
  rise: {
    slug: "rise",
    branch: "rise",
    name: "Rise",
    shortName: "Rise",
    styleFamily: "rise",
    description: "Rose gold, blush, soft florals, standards and self-trust.",
    background: "#2B282E",
    paper: "#FFF7F4",
    paperAlt: "#E7D6CF",
    ink: "#2B282E",
    mutedInk: "#C76E82",
    accent: "#E8B1A2",
    accentSoft: "#F7D6E6",
    plum: "#C76E82",
    lilac: "#DCC6E3",
    gold: "#E8B1A2",
    sage: "#E7D6CF",
    rose: "#C76E82",
    blue: "#DCC6E3",
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
    accent: "#BDB369",
    accentSoft: "#D8CEC2",
    plum: "#3E5A45",
    lilac: "#D8CEC2",
    gold: "#BDB369",
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
    background: "#2B2828",
    paper: "#FAF6EF",
    paperAlt: "#D6C7B2",
    ink: "#88ADCE",
    mutedInk: "#2B2828",
    accent: "#CC8FA1",
    accentSoft: "#F3C7CE",
    plum: "#88ADCE",
    lilac: "#C998E7",
    gold: "#BDB369",
    sage: "#96A78F",
    rose: "#CC8FA1",
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
    background: "#3D5445",
    paper: "#FAF6F0",
    paperAlt: "#D8CEC2",
    ink: "#3D5445",
    mutedInk: "#6F7D9C",
    accent: "#C97D8E",
    accentSoft: "#E8B2C0",
    plum: "#4F2D68",
    lilac: "#B7A3C6",
    gold: "#BDB369",
    sage: "#8F7F63",
    rose: "#C97D8E",
    blue: "#B8A3B7",
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
    background: "#2B282E",
    paper: "#FFF7F4",
    paperAlt: "#E7D6CF",
    ink: "#2B282E",
    mutedInk: "#C76E82",
    accent: "#E8B1A2",
    accentSoft: "#F7D6E6",
    plum: "#C76E82",
    lilac: "#DCC6E3",
    gold: "#E8B1A2",
    sage: "#E7D6CF",
    rose: "#C76E82",
    blue: "#DCC6E3",
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
    accent: "#BDB369",
    accentSoft: "#D8CEC2",
    plum: "#3E5A45",
    lilac: "#D8CEC2",
    gold: "#BDB369",
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
