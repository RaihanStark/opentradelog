import { and, eq, isNotNull } from 'drizzle-orm'
import type { DB } from '../db/client'
import { accounts, ruleConfigs, ruleEvents, trades } from '../db/schema'
import { newId } from '../db/ids'
import { getRuleProfile } from '../domain/rules'
import type { RuleTradeInput } from '../domain/rules'
import { ruleConfigToDto } from './accounts'
import { todayCtSessionDate } from '../domain/dates'
import type { AccountRuleStatus, RuleEvent, RuleType, RuleSeverity } from '@shared/domain'

/**
 * Evaluate an account's guardrails from its closed trades, persist the cached
 * high-water / MLL and regenerate its rule events, and return the live status.
 */
export function evaluateAccount(db: DB, accountId: string, nowIso: string): AccountRuleStatus {
  const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get()
  const cfgRow = db.select().from(ruleConfigs).where(eq(ruleConfigs.accountId, accountId)).get()
  if (!account || !cfgRow) return { accountId, meters: [], events: [] }

  const config = ruleConfigToDto(cfgRow)
  const closed = db
    .select()
    .from(trades)
    .where(and(eq(trades.accountId, accountId), eq(trades.status, 'CLOSED'), isNotNull(trades.exitAt)))
    .all()

  const ruleTrades: RuleTradeInput[] = closed.map((t) => ({
    netPnl: t.netPnl,
    sessionDate: t.sessionDate ?? '',
    exitAt: t.exitAt!
  }))

  const profile = getRuleProfile(config.profileKey)
  const result = profile.evaluate({
    startingBalance: account.startingBalance,
    config,
    trades: ruleTrades,
    todayDate: todayCtSessionDate(nowIso)
  })

  db.update(ruleConfigs)
    .set({ highWaterBalance: result.highWaterBalance, currentMll: result.currentMLL })
    .where(eq(ruleConfigs.accountId, accountId))
    .run()

  db.delete(ruleEvents).where(eq(ruleEvents.accountId, accountId)).run()
  const eventRows: RuleEvent[] = result.events.map((e) => ({
    id: newId('evt'),
    accountId,
    type: e.type as RuleType,
    severity: e.severity as RuleSeverity,
    occurredAt: e.occurredAt,
    balanceAtEvent: e.balanceAtEvent,
    thresholdAtEvent: e.thresholdAtEvent,
    message: e.message
  }))
  if (eventRows.length) {
    db.insert(ruleEvents).values(eventRows).run()
  }

  return { accountId, meters: result.meters, events: eventRows.reverse() }
}
