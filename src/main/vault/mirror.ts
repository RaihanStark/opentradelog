import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import type { DB } from '../db/client'
import { accounts, ruleConfigs, executions, trades, dailyJournals } from '../db/schema'
import { fromCents } from '@shared/money'

export const SCHEMA_VERSION = 1

function csvCell(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(headers: string[], rows: (unknown[])[]): string {
  const lines = [headers.join(',')]
  for (const r of rows) lines.push(r.map(csvCell).join(','))
  return lines.join('\n') + '\n'
}

/**
 * Mirror the working store to human-readable, documented open formats inside
 * the vault's export/ folder. accounts.csv + executions.jsonl are the canonical
 * re-importable source of truth; trades.csv and journal/*.md are for humans.
 */
export function writeMirror(db: DB, vaultDir: string, nowIso: string): void {
  const exportDir = join(vaultDir, 'export')
  mkdirSync(exportDir, { recursive: true })

  const accountRows = db.select().from(accounts).all()
  const cfgById = new Map(db.select().from(ruleConfigs).all().map((c) => [c.accountId, c]))
  const nameById = new Map(accountRows.map((a) => [a.id, a.name]))

  // accounts.csv (+ rule config) — canonical for rebuilding accounts
  writeFileSync(
    join(exportDir, 'accounts.csv'),
    toCsv(
      [
        'id', 'name', 'firm', 'broker', 'brokerAccountId', 'phase', 'sizeLabel', 'startingBalance',
        'profileKey', 'profitTarget', 'maxDrawdown', 'dailyLossLimit', 'drawdownMode',
        'drawdownLocksAtStart', 'consistencyPct'
      ],
      accountRows.map((a) => {
        const c = cfgById.get(a.id)
        return [
          a.id, a.name, a.firm, a.broker, a.brokerAccountId, a.phase, a.sizeLabel, a.startingBalance,
          c?.profileKey, c?.profitTarget, c?.maxDrawdown, c?.dailyLossLimit, c?.drawdownMode,
          c?.drawdownLocksAtStart ? 1 : 0, c?.consistencyPct
        ]
      })
    )
  )

  // executions.jsonl — canonical raw fills, append-friendly
  const execRows = db.select().from(executions).all()
  const jsonl = execRows
    .map((e) =>
      JSON.stringify({
        id: e.id,
        account: nameById.get(e.accountId) ?? e.accountId,
        symbol: e.symbol,
        contractId: e.contractId,
        side: e.side,
        size: e.size,
        price: e.price,
        profitAndLoss: e.profitAndLoss,
        fees: e.fees,
        voided: e.voided,
        orderId: e.orderId,
        executedAt: e.executedAt,
        source: e.source
      })
    )
    .join('\n')
  writeFileSync(join(exportDir, 'executions.jsonl'), jsonl + (jsonl ? '\n' : ''))

  // trades.csv — human-readable derived view
  const tradeRows = db.select().from(trades).all()
  writeFileSync(
    join(exportDir, 'trades.csv'),
    toCsv(
      [
        'account', 'symbol', 'direction', 'qty', 'avgEntry', 'avgExit', 'entryAt', 'exitAt',
        'status', 'grossPnlUSD', 'feesUSD', 'netPnlUSD', 'rMultiple', 'setupTag', 'mood',
        'disciplineScore', 'ruleAdherence', 'sessionDate', 'notes'
      ],
      tradeRows.map((t) => [
        nameById.get(t.accountId), t.symbol, t.direction, t.qty, t.avgEntryPrice, t.avgExitPrice,
        t.entryAt, t.exitAt, t.status, fromCents(t.grossPnl), fromCents(t.fees), fromCents(t.netPnl),
        t.rMultiple, t.setupTag, t.mood, t.disciplineScore, t.ruleAdherence, t.sessionDate, t.notes
      ])
    )
  )

  // journal/<account>/<date>.md
  const journalDir = join(exportDir, 'journal')
  if (existsSync(journalDir)) rmSync(journalDir, { recursive: true, force: true })
  for (const j of db.select().from(dailyJournals).all()) {
    const acct = (nameById.get(j.accountId) ?? j.accountId).replace(/[^\w.-]+/g, '_')
    const dir = join(journalDir, acct)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${j.tradingDate}.md`), journalMarkdown(j))
  }

  // schema.md + manifest.json
  writeFileSync(join(exportDir, 'schema.md'), SCHEMA_DOC)
  writeFileSync(
    join(exportDir, 'manifest.json'),
    JSON.stringify(
      {
        app: 'OpenTradeLog',
        schemaVersion: SCHEMA_VERSION,
        exportedAt: nowIso,
        counts: { accounts: accountRows.length, executions: execRows.length, trades: tradeRows.length }
      },
      null,
      2
    ) + '\n'
  )
}

function journalMarkdown(j: typeof dailyJournals.$inferSelect): string {
  const fm: string[] = ['---', `date: ${j.tradingDate}`]
  if (j.realizedPnl != null) fm.push(`realizedPnlUSD: ${fromCents(j.realizedPnl)}`)
  if (j.bias) fm.push(`bias: ${j.bias}`)
  if (j.moodStart) fm.push(`moodStart: ${j.moodStart}`)
  if (j.moodEnd) fm.push(`moodEnd: ${j.moodEnd}`)
  fm.push('---', '')
  const body: string[] = [`# ${j.tradingDate}`, '']
  if (j.gamePlan) body.push('## Game plan', j.gamePlan, '')
  if (j.review) body.push('## Review', j.review, '')
  if (j.whatWorked) body.push('## What worked', j.whatWorked, '')
  if (j.whatToImprove) body.push('## What to improve', j.whatToImprove, '')
  return fm.concat(body).join('\n')
}

const SCHEMA_DOC = `# OpenTradeLog vault — data schema (v${SCHEMA_VERSION})

This folder is **yours**. It contains your complete trading journal in open,
documented formats. OpenTradeLog can rebuild its database from these files, and
so can any other tool (or you, with a spreadsheet / pandas).

## Files

- \`journal.sqlite\` — the working store (open SQLite format). Derived from the
  files below; safe to delete and rebuild via "Import from vault".
- \`export/accounts.csv\` — one row per account + its rule config. **Canonical.**
- \`export/executions.jsonl\` — one JSON object per line, each a raw half-turn
  fill. **Canonical** source from which trades are derived.
- \`export/trades.csv\` — human-readable round-trip trades (derived). Money in USD.
- \`export/journal/<account>/<YYYY-MM-DD>.md\` — daily journals (Markdown + YAML).
- \`export/manifest.json\` — schema version, export timestamp, row counts.

## Conventions

- Money in the database is integer **cents**; CSV/Markdown mirrors render **USD**.
- Timestamps are ISO-8601 **UTC**. Session dates are **America/Chicago** with a
  17:00 CT rollover.
- \`side\`: 0 = buy, 1 = sell.

## executions.jsonl fields

\`id, account, symbol, contractId, side, size, price, profitAndLoss (cents|null),
fees (cents), voided, orderId, executedAt (ISO UTC), source\`

Trades are reconstructed from executions by a running-position round-trip
algorithm, so the fills are the source of truth.
`
