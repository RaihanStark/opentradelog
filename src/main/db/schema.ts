import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

/** Working-store schema. Money = integer cents. Timestamps = ISO-8601 UTC text. */

export const instruments = sqliteTable('instruments', {
  id: text('id').primaryKey(),
  symbol: text('symbol').notNull().unique(),
  contractId: text('contract_id'),
  tickSize: real('tick_size').notNull(),
  tickValue: integer('tick_value').notNull(), // cents per tick
  pointValue: integer('point_value').notNull() // cents per point
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  firm: text('firm').notNull().default('topstep'),
  broker: text('broker').notNull().default('csv'),
  brokerAccountId: text('broker_account_id'),
  name: text('name').notNull(),
  phase: text('phase').notNull().default('COMBINE'),
  sizeLabel: text('size_label').notNull().default('50K'),
  startingBalance: integer('starting_balance').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  lastSyncedAt: text('last_synced_at'),
  createdAt: text('created_at').notNull()
})

export const ruleConfigs = sqliteTable('rule_configs', {
  accountId: text('account_id')
    .primaryKey()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  profileKey: text('profile_key').notNull().default('topstep'),
  profitTarget: integer('profit_target').notNull().default(0),
  maxDrawdown: integer('max_drawdown').notNull().default(0),
  dailyLossLimit: integer('daily_loss_limit').notNull().default(0),
  drawdownMode: text('drawdown_mode').notNull().default('EOD_TRAILING'),
  drawdownLocksAtStart: integer('drawdown_locks_at_start', { mode: 'boolean' })
    .notNull()
    .default(true),
  consistencyPct: real('consistency_pct'),
  highWaterBalance: integer('high_water_balance').notNull().default(0),
  currentMll: integer('current_mll').notNull().default(0)
})

export const executions = sqliteTable(
  'executions',
  {
    id: text('id').primaryKey(), // source execution id (dedup key)
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    tradeId: text('trade_id'),
    contractId: text('contract_id').notNull(),
    symbol: text('symbol').notNull(),
    side: integer('side').notNull(), // 0 buy, 1 sell
    size: integer('size').notNull(),
    price: real('price').notNull(),
    profitAndLoss: integer('profit_and_loss'), // cents, null on opening fills
    fees: integer('fees').notNull().default(0),
    voided: integer('voided', { mode: 'boolean' }).notNull().default(false),
    orderId: text('order_id'),
    executedAt: text('executed_at').notNull(),
    source: text('source').notNull().default('csv')
  },
  (t) => [index('idx_exec_account_time').on(t.accountId, t.executedAt)]
)

export const trades = sqliteTable(
  'trades',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    instrumentId: text('instrument_id'),
    symbol: text('symbol').notNull(),
    direction: text('direction').notNull(),
    qty: integer('qty').notNull(),
    avgEntryPrice: real('avg_entry_price').notNull(),
    avgExitPrice: real('avg_exit_price'),
    entryAt: text('entry_at').notNull(),
    exitAt: text('exit_at'),
    status: text('status').notNull(),
    grossPnl: integer('gross_pnl').notNull().default(0),
    fees: integer('fees').notNull().default(0),
    netPnl: integer('net_pnl').notNull().default(0),
    plannedStop: real('planned_stop'),
    riskPerUnit: integer('risk_per_unit'),
    initialRisk: integer('initial_risk'),
    rMultiple: real('r_multiple'),
    mood: text('mood'),
    disciplineScore: integer('discipline_score'),
    ruleAdherence: integer('rule_adherence'),
    setupTag: text('setup_tag'),
    notes: text('notes'),
    sessionDate: text('session_date') // CT date YYYY-MM-DD
  },
  (t) => [index('idx_trade_account_exit').on(t.accountId, t.exitAt)]
)

export const dailyJournals = sqliteTable(
  'daily_journals',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    tradingDate: text('trading_date').notNull(),
    gamePlan: text('game_plan'),
    checklist: text('checklist'), // JSON
    bias: text('bias'),
    review: text('review'),
    whatWorked: text('what_worked'),
    whatToImprove: text('what_to_improve'),
    moodStart: text('mood_start'),
    moodEnd: text('mood_end'),
    realizedPnl: integer('realized_pnl'),
    eodBalance: integer('eod_balance'),
    maxAdverse: integer('max_adverse')
  },
  (t) => [uniqueIndex('idx_journal_account_date').on(t.accountId, t.tradingDate)]
)

export const ruleEvents = sqliteTable('rule_events', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  severity: text('severity').notNull(),
  occurredAt: text('occurred_at').notNull(),
  balanceAtEvent: integer('balance_at_event').notNull(),
  thresholdAtEvent: integer('threshold_at_event').notNull(),
  message: text('message').notNull()
})

export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  tradeId: text('trade_id'),
  journalId: text('journal_id'),
  kind: text('kind').notNull(),
  path: text('path').notNull(),
  caption: text('caption'),
  createdAt: text('created_at').notNull()
})

export const syncCursors = sqliteTable('sync_cursors', {
  accountId: text('account_id').primaryKey(),
  lastSyncedAt: text('last_synced_at'),
  lastError: text('last_error')
})

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
})

export type AccountRow = typeof accounts.$inferSelect
export type RuleConfigRow = typeof ruleConfigs.$inferSelect
export type ExecutionRow = typeof executions.$inferSelect
export type TradeRow = typeof trades.$inferSelect
export type InstrumentRow = typeof instruments.$inferSelect
export type DailyJournalRow = typeof dailyJournals.$inferSelect
export type RuleEventRow = typeof ruleEvents.$inferSelect
export type AttachmentRow = typeof attachments.$inferSelect
