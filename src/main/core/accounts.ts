import { eq } from 'drizzle-orm'
import type { DB } from '../db/client'
import { accounts, ruleConfigs } from '../db/schema'
import { newId } from '../db/ids'
import { TOPSTEP_COMBINE_PRESETS } from '../domain/rules'
import type { Account, AccountPhase, RuleConfig } from '@shared/domain'

export interface CreateAccountInput {
  name: string
  firm: string // 'topstep' | 'none'
  broker?: string
  brokerAccountId?: string | null
  phase: AccountPhase
  sizeLabel: string
  startingBalance?: number // cents; falls back to preset
}

export function createAccount(db: DB, input: CreateAccountInput): Account {
  const id = newId('acc')
  const now = new Date().toISOString()
  const isTopstep = input.firm === 'topstep'
  const preset = TOPSTEP_COMBINE_PRESETS[input.sizeLabel]
  const startingBalance =
    input.startingBalance ?? (isTopstep && preset ? preset.startingBalance : 0)

  db.insert(accounts)
    .values({
      id,
      firm: input.firm,
      broker: input.broker ?? 'csv',
      brokerAccountId: input.brokerAccountId ?? null,
      name: input.name,
      phase: input.phase,
      sizeLabel: input.sizeLabel,
      startingBalance,
      active: true,
      lastSyncedAt: null,
      createdAt: now
    })
    .run()

  const drawdownMode =
    input.phase === 'EXPRESS_FUNDED' ? 'INTRADAY_TRAILING' : input.phase === 'RETAIL' ? 'NONE' : 'EOD_TRAILING'
  const consistencyPct = !isTopstep ? null : input.phase === 'EXPRESS_FUNDED' ? 0.4 : 0.5

  db.insert(ruleConfigs)
    .values({
      accountId: id,
      profileKey: isTopstep ? 'topstep' : 'none',
      profitTarget: isTopstep && preset ? preset.profitTarget : 0,
      maxDrawdown: isTopstep && preset ? preset.maxDrawdown : 0,
      dailyLossLimit: isTopstep && preset ? preset.dailyLossLimit : 0,
      drawdownMode,
      drawdownLocksAtStart: true,
      consistencyPct,
      highWaterBalance: startingBalance,
      currentMll: 0
    })
    .run()

  return getAccount(db, id)!
}

export function accountToDto(row: typeof accounts.$inferSelect): Account {
  return {
    id: row.id,
    firm: row.firm,
    broker: row.broker,
    brokerAccountId: row.brokerAccountId,
    name: row.name,
    phase: row.phase as AccountPhase,
    sizeLabel: row.sizeLabel,
    startingBalance: row.startingBalance,
    active: row.active,
    lastSyncedAt: row.lastSyncedAt
  }
}

export function ruleConfigToDto(row: typeof ruleConfigs.$inferSelect): RuleConfig {
  return {
    accountId: row.accountId,
    profileKey: row.profileKey,
    profitTarget: row.profitTarget,
    maxDrawdown: row.maxDrawdown,
    dailyLossLimit: row.dailyLossLimit,
    drawdownMode: row.drawdownMode as RuleConfig['drawdownMode'],
    drawdownLocksAtStart: row.drawdownLocksAtStart,
    consistencyPct: row.consistencyPct,
    highWaterBalance: row.highWaterBalance,
    currentMLL: row.currentMll
  }
}

export function getAccount(db: DB, id: string): Account | null {
  const row = db.select().from(accounts).where(eq(accounts.id, id)).get()
  return row ? accountToDto(row) : null
}

export function listAccounts(db: DB): Account[] {
  return db.select().from(accounts).all().map(accountToDto)
}

export function getRuleConfig(db: DB, accountId: string): RuleConfig | null {
  const row = db.select().from(ruleConfigs).where(eq(ruleConfigs.accountId, accountId)).get()
  return row ? ruleConfigToDto(row) : null
}
