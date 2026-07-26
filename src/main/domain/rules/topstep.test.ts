import { describe, it, expect } from 'vitest'
import { topstepProfile } from './topstep'
import type { RuleConfig } from '@shared/domain'
import type { RuleTradeInput } from './types'

const START = 5_000_000 // $50k in cents

const cfg = (over: Partial<RuleConfig> = {}): RuleConfig => ({
  accountId: 'a',
  profileKey: 'topstep',
  profitTarget: 300_000,
  maxDrawdown: 200_000,
  dailyLossLimit: 100_000,
  drawdownMode: 'EOD_TRAILING',
  drawdownLocksAtStart: true,
  consistencyPct: 0.5,
  highWaterBalance: 0,
  currentMLL: 0,
  ...over
})

const day = (date: string, pnls: number[]): RuleTradeInput[] =>
  pnls.map((netPnl, i) => ({ netPnl, sessionDate: date, exitAt: `${date}T15:0${i}:00.000Z` }))

const meter = (r: ReturnType<typeof topstepProfile.evaluate>, type: string) =>
  r.meters.find((m) => m.type === type)

describe('topstep guardrails', () => {
  it('full buffer with no trades', () => {
    const r = topstepProfile.evaluate({ startingBalance: START, config: cfg(), trades: [], todayDate: '2026-07-27' })
    expect(r.currentBalance).toBe(START)
    expect(r.currentMLL).toBe(START - 200_000)
    const dd = meter(r, 'TRAILING_DRAWDOWN')!
    expect(dd.state).toBe('safe')
    expect(dd.value).toBe(200_000)
  })

  it('warns near the daily loss limit (85%)', () => {
    const trades = day('2026-07-27', [-85_000])
    const r = topstepProfile.evaluate({ startingBalance: START, config: cfg(), trades, todayDate: '2026-07-27' })
    const dll = meter(r, 'DAILY_LOSS_LIMIT')!
    expect(dll.state).toBe('warn')
    expect(r.events.some((e) => e.type === 'DAILY_LOSS_LIMIT' && e.severity === 'WARN')).toBe(true)
  })

  it('breaches the daily loss limit at 100%', () => {
    const trades = day('2026-07-27', [-100_000])
    const r = topstepProfile.evaluate({ startingBalance: START, config: cfg(), trades, todayDate: '2026-07-27' })
    expect(meter(r, 'DAILY_LOSS_LIMIT')!.state).toBe('breach')
    expect(r.events.some((e) => e.type === 'DAILY_LOSS_LIMIT' && e.severity === 'BREACH')).toBe(true)
  })

  it('flags a consistency violation (best day > 50% of total)', () => {
    const trades = [...day('2026-07-20', [200_000]), ...day('2026-07-21', [50_000])]
    const r = topstepProfile.evaluate({ startingBalance: START, config: cfg(), trades, todayDate: '2026-07-21' })
    const c = meter(r, 'CONSISTENCY')!
    expect(c.state).toBe('warn')
    // needs $4,000 total for a $2,000 best day at 50%
    expect(c.detail).toContain('$4,000')
  })

  it('detects a trailing max-loss breach', () => {
    const trades = [...day('2026-07-20', [100_000]), ...day('2026-07-21', [-210_000])]
    const r = topstepProfile.evaluate({ startingBalance: START, config: cfg(), trades, todayDate: '2026-07-21' })
    expect(r.events.some((e) => e.type === 'TRAILING_DRAWDOWN' && e.severity === 'BREACH')).toBe(true)
    expect(meter(r, 'TRAILING_DRAWDOWN')!.state).toBe('breach')
  })

  it('profit-target meter tracks cumulative profit', () => {
    const trades = day('2026-07-20', [150_000])
    const r = topstepProfile.evaluate({ startingBalance: START, config: cfg(), trades, todayDate: '2026-07-20' })
    const pt = meter(r, 'PROFIT_TARGET')!
    expect(pt.value).toBe(150_000)
    expect(pt.limit).toBe(300_000)
  })
})
