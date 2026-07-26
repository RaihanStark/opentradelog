import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import Papa from 'papaparse'
import { eq } from 'drizzle-orm'
import type { DB } from '../db/client'
import { accounts, ruleConfigs } from '../db/schema'
import type { RawExecution, IngestSource } from '@shared/domain'
import { parseExecutionsCsv } from '../sync/connectors/csv'
import { ingestExecutions, type IngestResult } from './ingest'

/** Import a fills CSV into a specific account. */
export function importCsvIntoAccount(
  db: DB,
  accountId: string,
  csvText: string,
  source: IngestSource = 'csv'
): IngestResult & { skipped: number } {
  const parsed = parseExecutionsCsv(csvText, source)
  const result = ingestExecutions(db, accountId, parsed.executions)
  return { ...result, skipped: parsed.skipped }
}

/**
 * Rebuild the entire database from a vault's export/ folder (accounts.csv +
 * executions.jsonl). Idempotent: existing accounts/executions are preserved,
 * missing ones recreated — the lossless portability round-trip.
 */
export function importFromVault(db: DB, vaultDir: string): { accounts: number; executions: number } {
  const exportDir = join(vaultDir, 'export')
  const accountsCsv = join(exportDir, 'accounts.csv')
  const execJsonl = join(exportDir, 'executions.jsonl')

  let accountCount = 0
  const nameToId = new Map<string, string>()

  if (existsSync(accountsCsv)) {
    const rows = Papa.parse<Record<string, string>>(readFileSync(accountsCsv, 'utf8'), {
      header: true,
      skipEmptyLines: true
    }).data
    for (const r of rows) {
      if (!r.id || !r.name) continue
      nameToId.set(r.name, r.id)
      db.insert(accounts)
        .values({
          id: r.id,
          name: r.name,
          firm: r.firm || 'topstep',
          broker: r.broker || 'csv',
          brokerAccountId: r.brokerAccountId || null,
          phase: r.phase || 'COMBINE',
          sizeLabel: r.sizeLabel || '50K',
          startingBalance: Number(r.startingBalance || 0),
          active: true,
          lastSyncedAt: null,
          createdAt: new Date().toISOString()
        })
        .onConflictDoNothing({ target: accounts.id })
        .run()
      db.insert(ruleConfigs)
        .values({
          accountId: r.id,
          profileKey: r.profileKey || 'topstep',
          profitTarget: Number(r.profitTarget || 0),
          maxDrawdown: Number(r.maxDrawdown || 0),
          dailyLossLimit: Number(r.dailyLossLimit || 0),
          drawdownMode: r.drawdownMode || 'EOD_TRAILING',
          drawdownLocksAtStart: r.drawdownLocksAtStart === '1' || r.drawdownLocksAtStart === 'true',
          consistencyPct: r.consistencyPct ? Number(r.consistencyPct) : null,
          highWaterBalance: Number(r.startingBalance || 0),
          currentMll: 0
        })
        .onConflictDoNothing({ target: ruleConfigs.accountId })
        .run()
      accountCount++
    }
  }

  // fall back to existing accounts for name mapping
  for (const a of db.select().from(accounts).all()) nameToId.set(a.name, a.id)

  let execCount = 0
  if (existsSync(execJsonl)) {
    const byAccount = new Map<string, RawExecution[]>()
    for (const line of readFileSync(execJsonl, 'utf8').split('\n')) {
      if (!line.trim()) continue
      const e = JSON.parse(line)
      const accountId = nameToId.get(e.account) ?? e.account
      const raw: RawExecution = {
        id: e.id,
        accountRef: e.account,
        symbol: e.symbol,
        contractId: e.contractId,
        side: e.side,
        size: e.size,
        price: e.price,
        profitAndLoss: e.profitAndLoss ?? null,
        fees: e.fees ?? 0,
        voided: !!e.voided,
        orderId: e.orderId ?? null,
        executedAt: e.executedAt,
        source: (e.source ?? 'csv') as IngestSource
      }
      const arr = byAccount.get(accountId) ?? []
      arr.push(raw)
      byAccount.set(accountId, arr)
      execCount++
    }
    for (const [accountId, raws] of byAccount) {
      const exists = db.select().from(accounts).where(eq(accounts.id, accountId)).get()
      if (exists) ingestExecutions(db, accountId, raws)
    }
  }

  return { accounts: accountCount, executions: execCount }
}
