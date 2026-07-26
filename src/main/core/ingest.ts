import { createHash } from 'crypto'
import { and, eq, inArray } from 'drizzle-orm'
import type { DB } from '../db/client'
import { executions, instruments, trades } from '../db/schema'
import type { RawExecution } from '@shared/domain'
import { groupRoundTrips, type FillLike } from '../domain/roundTrip'
import { ctSessionDate } from '../domain/dates'

export function tradeIdFor(firstExecId: string): string {
  return 'trd_' + createHash('sha1').update(firstExecId).digest('hex').slice(0, 20)
}

export interface IngestResult {
  received: number
  inserted: number
  trades: number
  openTrades: number
}

/**
 * Upsert normalized fills into an account, then (re)derive round-trip trades.
 * Idempotent: executions dedup by id; trades are keyed by their opening fill so
 * user journaling (notes, mood, R inputs) survives re-grouping.
 */
export function ingestExecutions(db: DB, accountId: string, raws: RawExecution[]): IngestResult {
  let inserted = 0

  const insertExec = db
    .insert(executions)
    .values(
      raws.map((r) => ({
        id: r.id,
        accountId,
        tradeId: null,
        contractId: r.contractId,
        symbol: r.symbol,
        side: r.side,
        size: r.size,
        price: r.price,
        profitAndLoss: r.profitAndLoss,
        fees: r.fees,
        voided: r.voided,
        orderId: r.orderId,
        executedAt: r.executedAt,
        source: r.source
      }))
    )
    .onConflictDoNothing({ target: executions.id })
  if (raws.length > 0) {
    const info = insertExec.run()
    inserted = info.changes
  }

  regroupTrades(db, accountId)

  const all = db.select().from(trades).where(eq(trades.accountId, accountId)).all()
  return {
    received: raws.length,
    inserted,
    trades: all.length,
    openTrades: all.filter((t) => t.status === 'OPEN').length
  }
}

/** Rebuild the derived trades for an account from its executions. */
export function regroupTrades(db: DB, accountId: string): void {
  const execRows = db
    .select()
    .from(executions)
    .where(and(eq(executions.accountId, accountId), eq(executions.voided, false)))
    .all()

  const pointValueBySymbol: Record<string, number> = {}
  const instrumentIdBySymbol: Record<string, string> = {}
  for (const ins of db.select().from(instruments).all()) {
    pointValueBySymbol[ins.symbol] = ins.pointValue
    instrumentIdBySymbol[ins.symbol] = ins.id
  }

  const fills: FillLike[] = execRows.map((e) => ({
    id: e.id,
    symbol: e.symbol,
    side: e.side as 0 | 1,
    size: e.size,
    price: e.price,
    profitAndLoss: e.profitAndLoss,
    fees: e.fees,
    executedAt: e.executedAt,
    orderId: e.orderId
  }))

  const rts = groupRoundTrips(fills, pointValueBySymbol)
  const existing = new Map(
    db.select().from(trades).where(eq(trades.accountId, accountId)).all().map((t) => [t.id, t])
  )
  const seen = new Set<string>()

  for (const rt of rts) {
    const id = tradeIdFor(rt.executionIds[0])
    seen.add(id)
    const prior = existing.get(id)
    const sessionDate = ctSessionDate(rt.exitAt ?? rt.entryAt)
    const initialRisk =
      prior?.riskPerUnit != null ? prior.riskPerUnit * rt.qty : (prior?.initialRisk ?? null)
    const rMultiple = initialRisk && initialRisk !== 0 ? rt.netPnl / initialRisk : null

    const computed = {
      accountId,
      instrumentId: instrumentIdBySymbol[rt.symbol] ?? null,
      symbol: rt.symbol,
      direction: rt.direction,
      qty: rt.qty,
      avgEntryPrice: rt.avgEntryPrice,
      avgExitPrice: rt.avgExitPrice,
      entryAt: rt.entryAt,
      exitAt: rt.exitAt,
      status: rt.status,
      grossPnl: rt.grossPnl,
      fees: rt.fees,
      netPnl: rt.netPnl,
      initialRisk,
      rMultiple,
      sessionDate
    }

    if (prior) {
      db.update(trades).set(computed).where(eq(trades.id, id)).run()
    } else {
      db.insert(trades)
        .values({
          id,
          ...computed,
          plannedStop: null,
          riskPerUnit: null,
          mood: null,
          disciplineScore: null,
          ruleAdherence: null,
          setupTag: null,
          notes: null
        })
        .run()
    }

    db.update(executions).set({ tradeId: id }).where(inArray(executions.id, rt.executionIds)).run()
  }

  // drop trades that no longer correspond to any current group
  const stale = [...existing.keys()].filter((id) => !seen.has(id))
  if (stale.length) db.delete(trades).where(inArray(trades.id, stale)).run()
}
