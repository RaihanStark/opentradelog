import type { RuleProfile } from './types'
import { topstepProfile } from './topstep'
import { noneProfile } from './none'

const registry = new Map<string, RuleProfile>()
for (const p of [topstepProfile, noneProfile]) registry.set(p.key, p)

export function getRuleProfile(key: string): RuleProfile {
  return registry.get(key) ?? noneProfile
}

export { topstepProfile, noneProfile }
export type { RuleProfile } from './types'
export * from './types'

/** Topstep Combine presets, cents. [profitTarget, maxDrawdown, dailyLossLimit] */
export const TOPSTEP_COMBINE_PRESETS: Record<
  string,
  { startingBalance: number; profitTarget: number; maxDrawdown: number; dailyLossLimit: number }
> = {
  '50K': { startingBalance: 50_000_00, profitTarget: 3_000_00, maxDrawdown: 2_000_00, dailyLossLimit: 1_000_00 },
  '100K': { startingBalance: 100_000_00, profitTarget: 6_000_00, maxDrawdown: 3_000_00, dailyLossLimit: 2_000_00 },
  '150K': { startingBalance: 150_000_00, profitTarget: 9_000_00, maxDrawdown: 4_500_00, dailyLossLimit: 3_000_00 }
}
