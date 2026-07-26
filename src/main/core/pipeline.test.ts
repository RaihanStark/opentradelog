import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { openDatabase, type DB } from '../db/client'
import { seedInstruments } from '../db/seed'
import { createAccount, getRuleConfig } from './accounts'
import { importCsvIntoAccount, importFromVault } from './import'
import { evaluateAccount } from './rules'
import { writeMirror } from '../vault/mirror'
import { trades } from '../db/schema'
import { eq } from 'drizzle-orm'

const MIGRATIONS = resolve('drizzle')
const NOW = '2026-07-21T20:00:00.000Z'

// Two winning days of MES, provided broker P&L. Day1 +$50, Day2 +$10.
const CSV = `Id,Symbol,Side,Qty,Price,PnL,Fees,Time
e1,MES,Buy,1,5000,,0.62,2026-07-20T15:00:00Z
e2,MES,Sell,1,5010,50,0.62,2026-07-20T15:05:00Z
e3,MES,Sell,1,5010,,0.62,2026-07-21T15:00:00Z
e4,MES,Buy,1,5008,10,0.62,2026-07-21T15:05:00Z
`

function freshDb(): DB {
  const { db } = openDatabase(':memory:', MIGRATIONS)
  seedInstruments(db)
  return db
}

describe('end-to-end pipeline', () => {
  let db: DB
  let accountId: string
  let vaultDir: string

  beforeAll(() => {
    db = freshDb()
    vaultDir = mkdtempSync(join(tmpdir(), 'otl-vault-'))
    const acc = createAccount(db, {
      name: 'Combine 50K',
      firm: 'topstep',
      phase: 'COMBINE',
      sizeLabel: '50K'
    })
    accountId = acc.id
  })

  it('imports CSV and groups into round-trip trades', () => {
    const r = importCsvIntoAccount(db, accountId, CSV)
    expect(r.received).toBe(4)
    expect(r.trades).toBe(2)
    expect(r.openTrades).toBe(0)
    const all = db.select().from(trades).where(eq(trades.accountId, accountId)).all()
    const totalNet = all.reduce((s, t) => s + t.netPnl, 0)
    // Day1: 5000 - 124 = 4876; Day2: 1000 - 124 = 876; total 5752 cents
    expect(totalNet).toBe(5752)
    expect(all.every((t) => t.status === 'CLOSED')).toBe(true)
  })

  it('is idempotent on re-import (dedup by execution id)', () => {
    const r = importCsvIntoAccount(db, accountId, CSV)
    expect(r.inserted).toBe(0)
    expect(r.trades).toBe(2)
  })

  it('applies Topstep presets and evaluates guardrails', () => {
    const cfg = getRuleConfig(db, accountId)!
    expect(cfg.profitTarget).toBe(300_000)
    expect(cfg.maxDrawdown).toBe(200_000)
    expect(cfg.dailyLossLimit).toBe(100_000)

    const status = evaluateAccount(db, accountId, NOW)
    const dd = status.meters.find((m) => m.type === 'TRAILING_DRAWDOWN')!
    expect(dd.state).toBe('safe')
    const pt = status.meters.find((m) => m.type === 'PROFIT_TARGET')!
    expect(pt.value).toBe(5752)
  })

  it('mirrors to open formats and rebuilds losslessly from the vault', () => {
    writeMirror(db, vaultDir, NOW)

    // Rebuild into a brand-new database purely from the exported files.
    const db2 = freshDb()
    const res = importFromVault(db2, vaultDir)
    expect(res.accounts).toBe(1)
    expect(res.executions).toBe(4)

    const original = db.select().from(trades).all()
    const rebuilt = db2.select().from(trades).all()
    expect(rebuilt.length).toBe(original.length)
    const sumNet = (rows: typeof rebuilt): number => rows.reduce((s, t) => s + t.netPnl, 0)
    expect(sumNet(rebuilt)).toBe(sumNet(original))
  })
})
