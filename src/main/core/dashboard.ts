import type { DB } from '../db/client'
import { listAccounts, getRuleConfig } from './accounts'
import { evaluateAccount } from './rules'
import { getAnalytics, listTrades } from './trades'
import { todayCtSessionDate } from '../domain/dates'
import type { DashboardAccount } from '@shared/api'

export function getDashboard(db: DB, nowIso: string): DashboardAccount[] {
  const today = todayCtSessionDate(nowIso)
  return listAccounts(db).map((account) => {
    const ruleConfig = getRuleConfig(db, account.id)!
    const ruleStatus = evaluateAccount(db, account.id, nowIso)
    const analytics = getAnalytics(db, account.id)
    const trades = listTrades(db, account.id)
    const todayPnl = trades
      .filter((t) => t.sessionDate === today && t.status === 'CLOSED')
      .reduce((s, t) => s + t.netPnl, 0)

    return {
      account,
      ruleConfig,
      ruleStatus,
      netPnl: analytics.netPnl,
      todayPnl,
      tradeCount: analytics.tradeCount,
      winRate: analytics.winRate,
      equityCurve: analytics.equityCurve.map((p) => ({ t: p.t, equity: p.equity })),
      recentTrades: trades.slice(0, 8)
    }
  })
}
