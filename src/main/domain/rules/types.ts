import type { GuardrailMeter, RuleConfig, RuleEvent } from '@shared/domain'

export interface RuleTradeInput {
  netPnl: number // cents
  sessionDate: string // CT date YYYY-MM-DD
  exitAt: string // ISO UTC
}

export interface EvaluateInput {
  startingBalance: number // cents
  config: RuleConfig
  trades: RuleTradeInput[] // CLOSED trades only
  todayDate: string // CT date used for the "daily loss limit" meter
  /** optional broker-reported balance to reconcile against (cents). */
  brokerBalance?: number
}

export type PendingRuleEvent = Omit<RuleEvent, 'id' | 'accountId'>

export interface EvaluateResult {
  meters: GuardrailMeter[]
  events: PendingRuleEvent[]
  highWaterBalance: number
  currentMLL: number
  currentBalance: number
}

export interface RuleProfile {
  key: string
  label: string
  evaluate(input: EvaluateInput): EvaluateResult
}
