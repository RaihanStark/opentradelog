import Papa from 'papaparse'
import type { IngestSource, RawExecution } from '@shared/domain'
import { toCents } from '@shared/money'

/**
 * Parse a fills/executions CSV (TopstepX, TradingView, or broker statement)
 * into normalized RawExecutions. Header matching is case/format-insensitive
 * with common aliases. Missing ids are synthesized deterministically so
 * re-importing the same file dedups instead of duplicating.
 */

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function pick(row: Record<string, string>, aliases: string[]): string | undefined {
  for (const a of aliases) {
    const v = row[normalizeKey(a)]
    if (v != null && v !== '') return v
  }
  return undefined
}

function parseSide(raw: string | undefined): 0 | 1 | null {
  if (raw == null) return null
  const s = raw.trim().toLowerCase()
  if (['buy', 'b', 'long', 'bought', '0', 'bid'].includes(s)) return 0
  if (['sell', 's', 'short', 'sold', '1', 'ask'].includes(s)) return 1
  return null
}

function parseTimestamp(raw: string | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  // epoch seconds / ms
  if (/^\d{10,13}$/.test(trimmed)) {
    const n = Number(trimmed)
    const ms = trimmed.length <= 10 ? n * 1000 : n
    return new Date(ms).toISOString()
  }
  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function parseNumber(raw: string | undefined): number | null {
  if (raw == null || raw === '') return null
  const cleaned = raw.replace(/[$,()]/g, (m) => (m === '(' || m === ')' ? '' : ''))
  const negative = /\(.*\)/.test(raw)
  const n = Number(cleaned.replace(/[()]/g, ''))
  if (Number.isNaN(n)) return null
  return negative ? -Math.abs(n) : n
}

export interface CsvParseResult {
  executions: RawExecution[]
  skipped: number
  errors: string[]
}

export function parseExecutionsCsv(text: string, source: IngestSource = 'csv'): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeKey(h)
  })

  const executions: RawExecution[] = []
  const errors: string[] = []
  let skipped = 0

  parsed.data.forEach((row, i) => {
    const symbolRaw = pick(row, ['symbol', 'contract', 'contractname', 'instrument', 'ticker'])
    const side = parseSide(pick(row, ['side', 'action', 'buysell', 'direction', 'ordertype']))
    const size = parseNumber(pick(row, ['size', 'qty', 'quantity', 'contracts', 'filledqty']))
    const price = parseNumber(pick(row, ['price', 'fillprice', 'avgprice', 'executionprice']))
    const executedAt = parseTimestamp(
      pick(row, ['executedat', 'time', 'timestamp', 'filltime', 'datetime', 'date', 'creationtimestamp'])
    )

    if (!symbolRaw || side == null || size == null || price == null || !executedAt) {
      skipped++
      return
    }

    // Symbol: strip month/year contract suffixes (ESZ5 -> ES, MESU24 -> MES)
    const symbol = symbolRaw
      .trim()
      .toUpperCase()
      .replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '')
      .replace(/\s+.*/, '')

    const pnlDollars = parseNumber(pick(row, ['pnl', 'profitandloss', 'profit', 'realizedpnl', 'netpnl']))
    const feesDollars = parseNumber(pick(row, ['fees', 'commission', 'commissions', 'fee']))
    const orderId = pick(row, ['orderid', 'order', 'orderno']) ?? null
    const voidedRaw = pick(row, ['voided', 'cancelled', 'canceled'])
    const voided = voidedRaw ? ['true', '1', 'yes'].includes(voidedRaw.toLowerCase()) : false

    const providedId = pick(row, ['id', 'executionid', 'fillid', 'tradeid'])
    const id =
      providedId ??
      `${symbol}-${executedAt}-${side}-${Math.abs(size)}-${price}-${i}`

    executions.push({
      id,
      accountRef: pick(row, ['account', 'accountid', 'accountname']) ?? '',
      symbol,
      contractId: symbolRaw.trim().toUpperCase(),
      side,
      size: Math.abs(size),
      price,
      profitAndLoss: pnlDollars != null ? toCents(pnlDollars) : null,
      fees: feesDollars != null ? toCents(Math.abs(feesDollars)) : 0,
      voided,
      orderId,
      executedAt,
      source
    })
  })

  if (parsed.errors.length) {
    for (const e of parsed.errors.slice(0, 5)) errors.push(`row ${e.row}: ${e.message}`)
  }

  return { executions, skipped, errors }
}
