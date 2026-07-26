import { and, eq } from 'drizzle-orm'
import type { DB } from '../db/client'
import { dailyJournals } from '../db/schema'
import { newId } from '../db/ids'
import type { DailyJournal } from '@shared/domain'
import type { JournalUpsert } from '@shared/api'

function toDto(row: typeof dailyJournals.$inferSelect): DailyJournal {
  return {
    id: row.id,
    accountId: row.accountId,
    tradingDate: row.tradingDate,
    gamePlan: row.gamePlan,
    checklist: row.checklist ? (JSON.parse(row.checklist) as DailyJournal['checklist']) : null,
    bias: row.bias,
    review: row.review,
    whatWorked: row.whatWorked,
    whatToImprove: row.whatToImprove,
    moodStart: row.moodStart,
    moodEnd: row.moodEnd,
    realizedPnl: row.realizedPnl,
    eodBalance: row.eodBalance,
    maxAdverse: row.maxAdverse
  }
}

export function getJournal(db: DB, accountId: string, tradingDate: string): DailyJournal | null {
  const row = db
    .select()
    .from(dailyJournals)
    .where(and(eq(dailyJournals.accountId, accountId), eq(dailyJournals.tradingDate, tradingDate)))
    .get()
  return row ? toDto(row) : null
}

export function upsertJournal(db: DB, p: JournalUpsert): DailyJournal {
  const existing = db
    .select()
    .from(dailyJournals)
    .where(and(eq(dailyJournals.accountId, p.accountId), eq(dailyJournals.tradingDate, p.tradingDate)))
    .get()

  const fields = {
    gamePlan: p.gamePlan ?? null,
    bias: p.bias ?? null,
    review: p.review ?? null,
    whatWorked: p.whatWorked ?? null,
    whatToImprove: p.whatToImprove ?? null,
    moodStart: p.moodStart ?? null,
    moodEnd: p.moodEnd ?? null
  }

  if (existing) {
    db.update(dailyJournals).set(fields).where(eq(dailyJournals.id, existing.id)).run()
    return getJournal(db, p.accountId, p.tradingDate)!
  }
  db.insert(dailyJournals)
    .values({ id: newId('jnl'), accountId: p.accountId, tradingDate: p.tradingDate, ...fields })
    .run()
  return getJournal(db, p.accountId, p.tradingDate)!
}
