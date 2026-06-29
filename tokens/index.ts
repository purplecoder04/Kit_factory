import {
  brandLeanTokens,
  brandTokens,
  landTokens,
  rebuildTokens,
  riseTokens,
  umbrellaTokens,
} from "@/tokens/brand"

export type BranchTokens = {
  slug: string
  name: string
  shortName: string
  background: string
  paper: string
  ink: string
  mutedInk: string
  accent: string
  accentSoft: string
  plum: string
  lilac: string
  gold: string
  sage: string
  line: string
  footer: string
}

export const branchTokens = {
  umbrella: umbrellaTokens,
  brand: brandTokens,
  "brand-lean": brandLeanTokens,
  rise: riseTokens,
  land: landTokens,
  rebuild: rebuildTokens,
}

export type BranchTokenSlug = keyof typeof branchTokens

export const branchTokenOptions = Object.values(branchTokens).map((tokens) => ({
  slug: tokens.slug,
  name: tokens.shortName,
}))

export function getBranchTokens(branch?: string): BranchTokens {
  return branch && branch in branchTokens
    ? branchTokens[branch as BranchTokenSlug]
    : branchTokens.brand
}
