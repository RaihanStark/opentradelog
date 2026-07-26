import { describe, it, expect } from 'vitest'
import { resolve } from 'path'
import { openDatabase, type DB } from '../db/client'
import { seedInstruments } from '../db/seed'
import { loadDemoData } from './demo'
import { listAccounts } from './accounts'
import { evaluateAccount } from './rules'
import { listTrades, getAnalytics } from './trades'

function freshDb(): DB {
  const { db } = openDatabase(':memory:', resolve('drizzle'))
  seedInstruments(db)
  return db
}

describe('demo data', () => {
  it('loads 3 fully-journaled accounts and is idempotent', () => {
    const db = freshDb()
    const first = loadDemoData(db)
    expect(first.loaded).toBe(true)
    expect(first.accounts).toBe(3)
    expect(loadDemoData(db).loaded).toBe(false) // idempotent

    const accounts = listAccounts(db)
    expect(accounts).toHaveLength(3)

    const combine = accounts.find((a) => a.name.startsWith('Combine'))!
    const trades = listTrades(db, combine.id)
    expect(trades.length).toBeGreaterThan(15)
    // journaling is populated on every trade
    expect(trades.every((t) => t.setupTag && t.mood && t.rMultiple != null)).toBe(true)

    const status = evaluateAccount(db, combine.id, '2026-07-15T20:00:00.000Z')
    const types = status.meters.map((m) => m.type)
    expect(types).toContain('TRAILING_DRAWDOWN')
    expect(types).toContain('PROFIT_TARGET')
    expect(types).toContain('CONSISTENCY')

    const analytics = getAnalytics(db, combine.id)
    expect(analytics.netPnl).toBeGreaterThan(0)
    expect(analytics.equityCurve.length).toBe(trades.length)

    // retail account has no guardrail meters
    const retail = accounts.find((a) => a.firm === 'none')!
    expect(evaluateAccount(db, retail.id, '2026-07-15T20:00:00.000Z').meters).toHaveLength(0)
  })
})
