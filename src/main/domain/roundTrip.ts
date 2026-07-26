/**
 * Round-trip grouping: fold a stream of half-turn fills (executions) into
 * complete trades using a running signed-position state machine, per symbol.
 *
 * Rules:
 *  - side 0 = buy (+size), side 1 = sell (-size)
 *  - a trade OPENS when position goes 0 -> non-zero (direction = sign of that fill)
 *  - scale-ins / scale-outs while non-zero belong to the same trade
 *  - a trade CLOSES when position returns to 0
 *  - a position FLIP (e.g. long 2 -> sell 3) splits the flipping fill: the part
 *    that returns to 0 closes the current trade, the remainder opens a new one
 *
 * P&L: prefer the broker-provided per-fill profitAndLoss (ProjectX populates it
 * on closing fills, null on opening). If a trade has no provided P&L at all, we
 * fall back to a price-based realized calc using the instrument point value.
 * Fees always sum per fill. Split fills split size/pnl/fees proportionally.
 */

import type { Direction, TradeStatus } from '@shared/domain'

export interface FillLike {
  id: string
  symbol: string
  side: 0 | 1
  size: number
  price: number
  profitAndLoss: number | null // cents
  fees: number // cents
  executedAt: string // ISO UTC
  orderId?: string | null
}

export interface RoundTrip {
  symbol: string
  direction: Direction
  qty: number // peak contracts held
  avgEntryPrice: number
  avgExitPrice: number | null
  entryAt: string
  exitAt: string | null
  status: TradeStatus
  grossPnl: number // cents
  fees: number // cents
  netPnl: number // cents
  executionIds: string[]
}

interface OpenState {
  direction: Direction
  entrySize: number // cumulative contracts entered
  entryNotional: number // Σ price*size on entry side (for avg)
  exitSize: number
  exitNotional: number
  peak: number
  fees: number
  providedPnl: number
  hasProvidedPnl: boolean
  entryAt: string
  lastAt: string
  executionIds: string[]
}

function newState(direction: Direction, at: string): OpenState {
  return {
    direction,
    entrySize: 0,
    entryNotional: 0,
    exitSize: 0,
    exitNotional: 0,
    peak: 0,
    fees: 0,
    providedPnl: 0,
    hasProvidedPnl: false,
    entryAt: at,
    lastAt: at,
    executionIds: []
  }
}

/** Add a (possibly partial) fill contribution to the open trade state. */
function apply(
  st: OpenState,
  isEntry: boolean,
  size: number,
  price: number,
  fees: number,
  pnl: number | null,
  at: string
): void {
  if (isEntry) {
    st.entrySize += size
    st.entryNotional += price * size
  } else {
    st.exitSize += size
    st.exitNotional += price * size
  }
  st.fees += fees
  if (pnl != null) {
    st.providedPnl += pnl
    st.hasProvidedPnl = true
  }
  st.lastAt = at
}

function finalize(
  st: OpenState,
  symbol: string,
  pointValue: number | undefined,
  closed: boolean
): RoundTrip {
  const avgEntryPrice = st.entrySize > 0 ? st.entryNotional / st.entrySize : 0
  const avgExitPrice = st.exitSize > 0 ? st.exitNotional / st.exitSize : null

  let grossPnl: number
  if (st.hasProvidedPnl) {
    grossPnl = Math.round(st.providedPnl)
  } else if (closed && avgExitPrice != null && pointValue != null) {
    const dir = st.direction === 'LONG' ? 1 : -1
    const matched = Math.min(st.entrySize, st.exitSize)
    grossPnl = Math.round(dir * (avgExitPrice - avgEntryPrice) * pointValue * matched)
  } else {
    grossPnl = 0
  }

  return {
    symbol,
    direction: st.direction,
    qty: st.peak,
    avgEntryPrice,
    avgExitPrice,
    entryAt: st.entryAt,
    exitAt: closed ? st.lastAt : null,
    status: closed ? 'CLOSED' : 'OPEN',
    grossPnl,
    fees: Math.round(st.fees),
    netPnl: Math.round(grossPnl - st.fees),
    executionIds: st.executionIds
  }
}

export function groupRoundTrips(
  fills: FillLike[],
  pointValueBySymbol: Record<string, number> = {}
): RoundTrip[] {
  // stable chronological order (tie-break on id)
  const sorted = [...fills].sort((a, b) => {
    if (a.executedAt !== b.executedAt) return a.executedAt < b.executedAt ? -1 : 1
    return a.id < b.id ? -1 : 1
  })

  const bySymbol = new Map<string, FillLike[]>()
  for (const f of sorted) {
    const arr = bySymbol.get(f.symbol) ?? []
    arr.push(f)
    bySymbol.set(f.symbol, arr)
  }

  const trades: RoundTrip[] = []

  for (const [symbol, symFills] of bySymbol) {
    let position = 0 // signed
    let st: OpenState | null = null

    for (const f of symFills) {
      const signed = f.side === 0 ? f.size : -f.size
      let remaining = f.size
      const perUnitFee = f.size > 0 ? f.fees / f.size : 0
      const perUnitPnl = f.profitAndLoss != null && f.size > 0 ? f.profitAndLoss / f.size : null

      // flat -> open a fresh trade in the fill's direction
      if (position === 0) {
        st = newState(f.side === 0 ? 'LONG' : 'SHORT', f.executedAt)
      }

      // If the fill reduces the current position (opposite sign), it may close
      // and possibly flip.
      const reduces = st != null && Math.sign(signed) === -Math.sign(position) && position !== 0
      if (reduces && st) {
        const closeQty = Math.min(remaining, Math.abs(position))
        // closing portion
        apply(
          st,
          false,
          closeQty,
          f.price,
          perUnitFee * closeQty,
          perUnitPnl != null ? perUnitPnl * closeQty : null,
          f.executedAt
        )
        st.executionIds.push(f.id)
        position += signed > 0 ? closeQty : -closeQty
        remaining -= closeQty

        if (position === 0) {
          trades.push(finalize(st, symbol, pointValueBySymbol[symbol], true))
          st = null
        }

        // flip: remainder opens a new trade in the opposite direction
        if (remaining > 0) {
          st = newState(f.side === 0 ? 'LONG' : 'SHORT', f.executedAt)
          apply(
            st,
            true,
            remaining,
            f.price,
            perUnitFee * remaining,
            null,
            f.executedAt
          )
          st.executionIds.push(f.id)
          position += signed > 0 ? remaining : -remaining
          st.peak = Math.max(st.peak, Math.abs(position))
          remaining = 0
        }
        continue
      }

      // Otherwise the fill opens or scales-in the current trade
      if (st) {
        apply(st, true, remaining, f.price, f.fees, f.profitAndLoss, f.executedAt)
        st.executionIds.push(f.id)
        position += signed
        st.peak = Math.max(st.peak, Math.abs(position))
      }
    }

    // leftover open position => open trade
    if (st && position !== 0) {
      trades.push(finalize(st, symbol, pointValueBySymbol[symbol], false))
    }
  }

  // return in entry order
  trades.sort((a, b) => (a.entryAt < b.entryAt ? -1 : a.entryAt > b.entryAt ? 1 : 0))
  return trades
}
