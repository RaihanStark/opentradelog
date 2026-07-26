import { describe, it, expect } from 'vitest'
import { groupRoundTrips, type FillLike } from './roundTrip'

const t = (n: number): string => `2026-07-27T14:${String(n).padStart(2, '0')}:00.000Z`

function fill(p: Partial<FillLike> & Pick<FillLike, 'id' | 'side' | 'size' | 'price'>): FillLike {
  return {
    symbol: 'MES',
    profitAndLoss: null,
    fees: 0,
    executedAt: t(Number(p.id)),
    orderId: null,
    ...p
  }
}

describe('groupRoundTrips', () => {
  it('groups a simple long round trip using provided P&L', () => {
    const fills: FillLike[] = [
      fill({ id: '1', side: 0, size: 2, price: 5000 }),
      fill({ id: '2', side: 1, size: 2, price: 5010, profitAndLoss: 12500, fees: 200 })
    ]
    const [trade, ...rest] = groupRoundTrips(fills)
    expect(rest).toHaveLength(0)
    expect(trade.status).toBe('CLOSED')
    expect(trade.direction).toBe('LONG')
    expect(trade.qty).toBe(2)
    expect(trade.avgEntryPrice).toBe(5000)
    expect(trade.avgExitPrice).toBe(5010)
    expect(trade.grossPnl).toBe(12500)
    expect(trade.fees).toBe(200)
    expect(trade.netPnl).toBe(12300)
    expect(trade.executionIds).toEqual(['1', '2'])
  })

  it('computes price-based P&L when broker P&L is absent (MES $5/pt)', () => {
    // MES point value = $5 = 500 cents. Long 1 @5000 -> exit @5002 = +2pts = +$10
    const fills: FillLike[] = [
      fill({ id: '1', side: 0, size: 1, price: 5000 }),
      fill({ id: '2', side: 1, size: 1, price: 5002 })
    ]
    const [trade] = groupRoundTrips(fills, { MES: 500 })
    expect(trade.grossPnl).toBe(1000) // $10
  })

  it('handles a short round trip', () => {
    const fills: FillLike[] = [
      fill({ id: '1', side: 1, size: 1, price: 5002 }),
      fill({ id: '2', side: 0, size: 1, price: 5000 })
    ]
    const [trade] = groupRoundTrips(fills, { MES: 500 })
    expect(trade.direction).toBe('SHORT')
    expect(trade.grossPnl).toBe(1000) // short profits when price falls 2 pts
  })

  it('handles scale-in and scale-out within one trade', () => {
    const fills: FillLike[] = [
      fill({ id: '1', side: 0, size: 1, price: 5000 }),
      fill({ id: '2', side: 0, size: 1, price: 5002 }), // avg entry 5001
      fill({ id: '3', side: 1, size: 1, price: 5006 }),
      fill({ id: '4', side: 1, size: 1, price: 5008 }) // avg exit 5007
    ]
    const trades = groupRoundTrips(fills, { MES: 500 })
    expect(trades).toHaveLength(1)
    const trade = trades[0]
    expect(trade.qty).toBe(2)
    expect(trade.avgEntryPrice).toBeCloseTo(5001)
    expect(trade.avgExitPrice).toBeCloseTo(5007)
    // +6 pts * $5 * 2 = $60
    expect(trade.grossPnl).toBe(6000)
  })

  it('splits a position flip into two trades', () => {
    // long 2, then sell 3 -> closes long 2 and opens short 1
    const fills: FillLike[] = [
      fill({ id: '1', side: 0, size: 2, price: 5000 }),
      fill({ id: '2', side: 1, size: 3, price: 5004 }),
      fill({ id: '3', side: 0, size: 1, price: 5001 }) // cover the short 1
    ]
    const trades = groupRoundTrips(fills, { MES: 500 })
    expect(trades).toHaveLength(2)
    const long = trades.find((x) => x.direction === 'LONG')!
    const short = trades.find((x) => x.direction === 'SHORT')!
    expect(long.status).toBe('CLOSED')
    expect(long.qty).toBe(2)
    // long: +4 pts * $5 * 2 = $40
    expect(long.grossPnl).toBe(4000)
    expect(short.status).toBe('CLOSED')
    expect(short.qty).toBe(1)
    // short: entered 5004, covered 5001 => +3 pts * $5 * 1 = $15
    expect(short.grossPnl).toBe(1500)
  })

  it('leaves an unbalanced position as an OPEN trade', () => {
    const fills: FillLike[] = [
      fill({ id: '1', side: 0, size: 2, price: 5000 }),
      fill({ id: '2', side: 1, size: 1, price: 5004 })
    ]
    const trades = groupRoundTrips(fills, { MES: 500 })
    expect(trades).toHaveLength(1)
    expect(trades[0].status).toBe('OPEN')
    expect(trades[0].exitAt).toBeNull()
  })
})
