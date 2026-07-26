/** Retail / no-firm profile: no guardrails, just track balance. */
import type { EvaluateInput, EvaluateResult, RuleProfile } from './types'

export const noneProfile: RuleProfile = {
  key: 'none',
  label: 'Retail (no rules)',
  evaluate(input: EvaluateInput): EvaluateResult {
    const balance = input.startingBalance + input.trades.reduce((s, t) => s + t.netPnl, 0)
    return {
      meters: [],
      events: [],
      highWaterBalance: Math.max(input.startingBalance, balance),
      currentMLL: 0,
      currentBalance: balance
    }
  }
}
