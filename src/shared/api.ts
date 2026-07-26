import type {
  Account,
  AccountPhase,
  AccountRuleStatus,
  AnalyticsSummary,
  DailyJournal,
  RuleConfig,
  Trade
} from './domain'

export interface VaultStatus {
  open: boolean
  dir: string | null
}

export interface ImportResult {
  received: number
  inserted: number
  trades: number
  openTrades: number
  skipped: number
}

export interface AccountInput {
  name: string
  firm: string // 'topstep' | 'none'
  phase: AccountPhase
  sizeLabel: string
  startingBalance?: number // cents (optional; preset used for topstep)
  brokerAccountId?: string | null
}

export interface TradeJournalPatch {
  mood?: string | null
  disciplineScore?: number | null
  ruleAdherence?: number | null
  setupTag?: string | null
  notes?: string | null
  plannedStop?: number | null
  riskPerUnit?: number | null
}

export interface DashboardAccount {
  account: Account
  ruleConfig: RuleConfig
  ruleStatus: AccountRuleStatus
  netPnl: number
  todayPnl: number
  tradeCount: number
  winRate: number
  equityCurve: { t: string; equity: number }[]
  recentTrades: Trade[]
}

export interface JournalUpsert {
  accountId: string
  tradingDate: string
  gamePlan?: string | null
  bias?: string | null
  review?: string | null
  whatWorked?: string | null
  whatToImprove?: string | null
  moodStart?: string | null
  moodEnd?: string | null
}

/** The typed surface exposed on `window.otl` (preload) and called by the UI. */
export interface OtlApi {
  vaultStatus(): Promise<VaultStatus>
  chooseVault(): Promise<VaultStatus>
  importVault(): Promise<{ accounts: number; executions: number }>

  listAccounts(): Promise<Account[]>
  createAccount(input: AccountInput): Promise<Account>
  getRuleConfig(accountId: string): Promise<RuleConfig | null>
  getRuleStatus(accountId: string): Promise<AccountRuleStatus>

  importCsv(accountId: string): Promise<ImportResult | null>

  getDashboard(): Promise<DashboardAccount[]>
  listTrades(accountId?: string): Promise<Trade[]>
  updateTrade(id: string, patch: TradeJournalPatch): Promise<Trade | null>
  getAnalytics(accountId?: string): Promise<AnalyticsSummary>

  getJournal(accountId: string, tradingDate: string): Promise<DailyJournal | null>
  upsertJournal(payload: JournalUpsert): Promise<DailyJournal>
}

export const IPC_CHANNELS: Record<keyof OtlApi, string> = {
  vaultStatus: 'vault:status',
  chooseVault: 'vault:choose',
  importVault: 'vault:import',
  listAccounts: 'accounts:list',
  createAccount: 'accounts:create',
  getRuleConfig: 'accounts:ruleConfig',
  getRuleStatus: 'rules:status',
  importCsv: 'import:csv',
  getDashboard: 'dashboard:get',
  listTrades: 'trades:list',
  updateTrade: 'trades:update',
  getAnalytics: 'analytics:get',
  getJournal: 'journal:get',
  upsertJournal: 'journal:upsert'
}
