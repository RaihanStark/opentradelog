/**
 * Canonical domain DTOs shared across main / preload / renderer (the IPC wire
 * types). Money fields are integer cents. Timestamps are ISO-8601 UTC strings.
 * These deliberately do NOT import Drizzle so the renderer bundle stays clean.
 */

export type AccountPhase = 'COMBINE' | 'EXPRESS_FUNDED' | 'LIVE_FUNDED' | 'RETAIL'
export type DrawdownMode = 'EOD_TRAILING' | 'INTRADAY_TRAILING' | 'NONE'
export type Direction = 'LONG' | 'SHORT'
export type TradeStatus = 'OPEN' | 'CLOSED'
export type RuleType =
  | 'TRAILING_DRAWDOWN'
  | 'DAILY_LOSS_LIMIT'
  | 'CONSISTENCY'
  | 'PROFIT_TARGET'
export type RuleSeverity = 'WARN' | 'BREACH'
export type AttachmentKind = 'IMAGE' | 'TRADINGVIEW_LINK'
export type IngestSource = 'csv' | 'projectx' | 'tradovate' | 'manual'

export interface Instrument {
  id: string
  symbol: string
  contractId: string | null
  tickSize: number
  tickValue: number // cents per tick
  pointValue: number // cents per point
}

export interface Account {
  id: string
  firm: string // 'topstep' | 'apex' | 'none' | ...
  broker: string // 'projectx' | 'tradovate' | 'csv' | 'manual'
  brokerAccountId: string | null
  name: string
  phase: AccountPhase
  sizeLabel: string // '50K' | '100K' | ...
  startingBalance: number // cents
  active: boolean
  lastSyncedAt: string | null
}

export interface RuleConfig {
  accountId: string
  profileKey: string // 'topstep' | 'none'
  profitTarget: number // cents (0 if none)
  maxDrawdown: number // cents (trailing buffer)
  dailyLossLimit: number // cents
  drawdownMode: DrawdownMode
  drawdownLocksAtStart: boolean
  consistencyPct: number | null // 0.5, 0.4, or null
  highWaterBalance: number // cents (cached)
  currentMLL: number // cents (cached max-loss floor)
}

export interface Execution {
  id: string
  accountId: string
  tradeId: string | null
  contractId: string
  symbol: string
  side: 0 | 1 // 0 = buy/bid, 1 = sell/ask
  size: number
  price: number
  profitAndLoss: number | null // cents; null on opening fills
  fees: number // cents
  voided: boolean
  orderId: string | null
  executedAt: string // ISO UTC
  source: IngestSource
}

export interface Trade {
  id: string
  accountId: string
  instrumentId: string
  symbol: string
  direction: Direction
  qty: number
  avgEntryPrice: number
  avgExitPrice: number | null
  entryAt: string
  exitAt: string | null
  status: TradeStatus
  grossPnl: number // cents
  fees: number // cents
  netPnl: number // cents
  plannedStop: number | null
  riskPerUnit: number | null // cents
  initialRisk: number | null // cents
  rMultiple: number | null
  mood: string | null
  disciplineScore: number | null // 1..5
  ruleAdherence: number | null // 1..5
  setupTag: string | null
  notes: string | null
  sessionDate: string | null // CT date YYYY-MM-DD
}

export interface DailyJournal {
  id: string
  accountId: string
  tradingDate: string // CT date YYYY-MM-DD
  gamePlan: string | null
  checklist: { item: string; checked: boolean }[] | null
  bias: string | null
  review: string | null
  whatWorked: string | null
  whatToImprove: string | null
  moodStart: string | null
  moodEnd: string | null
  realizedPnl: number | null
  eodBalance: number | null
  maxAdverse: number | null
}

export interface RuleEvent {
  id: string
  accountId: string
  type: RuleType
  severity: RuleSeverity
  occurredAt: string
  balanceAtEvent: number
  thresholdAtEvent: number
  message: string
}

export interface Attachment {
  id: string
  tradeId: string | null
  journalId: string | null
  kind: AttachmentKind
  path: string // relative to vault (image) or external URL (tradingview)
  caption: string | null
  createdAt: string
}

/** Normalized fill produced by any BrokerConnector / importer. */
export interface RawExecution {
  id: string
  accountRef: string // brokerAccountId or account name to map to an Account
  symbol: string
  contractId: string
  side: 0 | 1
  size: number
  price: number
  profitAndLoss: number | null // cents
  fees: number // cents
  voided: boolean
  orderId: string | null
  executedAt: string // ISO UTC
  source: IngestSource
}

/** One guardrail's live status for the dashboard meters. */
export type MeterState = 'safe' | 'warn' | 'breach' | 'na'
export interface GuardrailMeter {
  type: RuleType
  label: string
  state: MeterState
  /** used vs limit rendered by the meter (both cents unless pct). */
  value: number
  limit: number
  /** primary human-readable figure, e.g. "$1,740 buffer". */
  headline: string
  detail?: string
}

export interface AccountRuleStatus {
  accountId: string
  meters: GuardrailMeter[]
  events: RuleEvent[]
}

export interface EquityPoint {
  t: string
  equity: number // cumulative netPnl, cents
  drawdown: number // <= 0, cents
}

export interface AnalyticsSummary {
  tradeCount: number
  wins: number
  losses: number
  winRate: number
  netPnl: number
  grossProfit: number
  grossLoss: number
  profitFactor: number | null
  avgWin: number
  avgLoss: number
  expectancy: number
  avgR: number | null
  maxDrawdown: number
  equityCurve: EquityPoint[]
  bySymbol: { key: string; netPnl: number; trades: number }[]
  bySetup: { key: string; netPnl: number; trades: number }[]
}
