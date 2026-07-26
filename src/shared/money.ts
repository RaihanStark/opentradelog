/**
 * Money is stored everywhere as integer cents to avoid float drift.
 * These helpers are pure and safe to use in main, preload, and renderer.
 */

export type Cents = number

export function toCents(dollars: number): Cents {
  return Math.round(dollars * 100)
}

export function fromCents(cents: Cents): number {
  return cents / 100
}

/** "$1,234.50" / "-$80.00" (sign kept, symbol after sign). */
export function formatUSD(cents: Cents, opts: { sign?: boolean; cents?: boolean } = {}): string {
  const showCents = opts.cents ?? true
  const negative = cents < 0
  const abs = Math.abs(cents)
  const dollars = abs / 100
  const body = dollars.toLocaleString('en-US', {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0
  })
  const signStr = negative ? '-' : opts.sign ? '+' : ''
  return `${signStr}$${body}`
}

/** Compact money for dense tables: +1,250 / -80 (no symbol, no cents by default). */
export function formatCentsCompact(cents: Cents, showCents = false): string {
  const negative = cents < 0
  const abs = Math.abs(cents)
  const value = abs / 100
  const body = value.toLocaleString('en-US', {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0
  })
  return `${negative ? '-' : '+'}${body}`
}

export function formatR(r: number | null | undefined): string {
  if (r == null || Number.isNaN(r)) return '—'
  const sign = r >= 0 ? '+' : '-'
  return `${sign}${Math.abs(r).toFixed(2)}R`
}

export function formatPrice(price: number): string {
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

export function formatPct(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`
}
