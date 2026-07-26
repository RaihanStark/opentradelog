import { and, desc, eq } from 'drizzle-orm'
import type { DB } from '../db/client'
import { trades, instruments } from '../db/schema'
import { computeAnalytics, type AnalyticsTrade } from '../domain/analytics'
import type { AnalyticsSummary, Direction, Trade, TradeStatus } from '@shared/domain'

export function tradeToDto(row: typeof trades.$inferSelect): Trade {
  return {
    id: row.id,
    accountId: row.accountId,
    instrumentId: row.instrumentId ?? '',
    symbol: row.symbol,
    direction: row.direction as Direction,
    qty: row.qty,
    avgEntryPrice: row.avgEntryPrice,
    avgExitPrice: row.avgExitPrice,
    entryAt: row.entryAt,
    exitAt: row.exitAt,
    status: row.status as TradeStatus,
    grossPnl: row.grossPnl,
    fees: row.fees,
    netPnl: row.netPnl,
    plannedStop: row.plannedStop,
    riskPerUnit: row.riskPerUnit,
    initialRisk: row.initialRisk,
    rMultiple: row.rMultiple,
    mood: row.mood,
    disciplineScore: row.disciplineScore,
    ruleAdherence: row.ruleAdherence,
    setupTag: row.setupTag,
    notes: row.notes,
    sessionDate: row.sessionDate
  }
}

export function listTrades(db: DB, accountId?: string): Trade[] {
  const rows = accountId
    ? db.select().from(trades).where(eq(trades.accountId, accountId)).orderBy(desc(trades.entryAt)).all()
    : db.select().from(trades).orderBy(desc(trades.entryAt)).all()
  return rows.map(tradeToDto)
}

export function getTrade(db: DB, id: string): Trade | null {
  const row = db.select().from(trades).where(eq(trades.id, id)).get()
  return row ? tradeToDto(row) : null
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

export function updateTradeJournal(db: DB, id: string, patch: TradeJournalPatch): Trade | null {
  const row = db.select().from(trades).where(eq(trades.id, id)).get()
  if (!row) return null

  const set: Record<string, unknown> = { ...patch }

  // derive risk/R from a planned stop if a stop was supplied without explicit risk
  let riskPerUnit = patch.riskPerUnit ?? row.riskPerUnit
  const plannedStop = patch.plannedStop ?? row.plannedStop
  if (patch.plannedStop != null && patch.riskPerUnit == null) {
    const ins = row.instrumentId
      ? db.select().from(instruments).where(eq(instruments.id, row.instrumentId)).get()
      : null
    if (ins) riskPerUnit = Math.round(Math.abs(row.avgEntryPrice - patch.plannedStop) * ins.pointValue)
  }
  const initialRisk = riskPerUnit != null ? riskPerUnit * row.qty : null
  set.riskPerUnit = riskPerUnit
  set.initialRisk = initialRisk
  set.plannedStop = plannedStop
  set.rMultiple = initialRisk && initialRisk !== 0 ? row.netPnl / initialRisk : null

  db.update(trades).set(set).where(eq(trades.id, id)).run()
  return getTrade(db, id)
}

export function getAnalytics(db: DB, accountId?: string): AnalyticsSummary {
  const rows = accountId
    ? db.select().from(trades).where(and(eq(trades.accountId, accountId), eq(trades.status, 'CLOSED'))).all()
    : db.select().from(trades).where(eq(trades.status, 'CLOSED')).all()
  const input: AnalyticsTrade[] = rows.map((t) => ({
    netPnl: t.netPnl,
    rMultiple: t.rMultiple,
    exitAt: t.exitAt ?? t.entryAt,
    symbol: t.symbol,
    setupTag: t.setupTag
  }))
  return computeAnalytics(input)
}
