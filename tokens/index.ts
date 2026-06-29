import { brandTokens } from "@/tokens/brand"

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
  sage: string
  line: string
  footer: string
}

export const branchTokens = {
  brand: brandTokens,
}

export function getBranchTokens(): BranchTokens {
  return branchTokens.brand
}
