/**
 * Topstep guardrail math (Combine + Express Funded).
 *
 *  - Trailing Max Loss (MLL): floor = highWater - maxDrawdown, trails the peak
 *    UP only; locks once it reaches the original starting balance. Combine uses
 *    the end-of-day peak (EOD_TRAILING); Express Funded trails intraday
 *    (INTRADAY_TRAILING). Breach when balance <= MLL.
 *  - Daily Loss Limit: soft, per CT session; WARN at 80%, soft BREACH at 100%.
 *  - Consistency: best-day P&L must be <= consistencyPct * total profit.
 *  - Profit Target: cumulative realized >= profitTarget.
 *
 * Realized-only (from closed trades). Intraday peak is approximated at
 * trade-close granularity, the finest data a journal has.
 */

import type { GuardrailMeter } from '@shared/domain'
import type { EvaluateInput, EvaluateResult, PendingRuleEvent, RuleProfile } from './types'

const WARN_DD_FRACTION = 0.2 // warn when buffer < 20% of maxDrawdown
const WARN_DLL_FRACTION = 0.8 // warn when 80% of DLL used

interface DayAgg {
  date: string
  realized: number
  trades: { netPnl: number; exitAt: string }[]
}

function groupByDay(trades: EvaluateInput['trades']): DayAgg[] {
  const map = new Map<string, DayAgg>()
  for (const t of trades) {
    const d = map.get(t.sessionDate) ?? { date: t.sessionDate, realized: 0, trades: [] }
    d.realized += t.netPnl
    d.trades.push({ netPnl: t.netPnl, exitAt: t.exitAt })
    map.set(t.sessionDate, d)
  }
  const days = [...map.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  for (const d of days) d.trades.sort((a, b) => (a.exitAt < b.exitAt ? -1 : 1))
  return days
}

function mllFrom(highWater: number, maxDrawdown: number, start: number, lockAtStart: boolean): number {
  const floor = highWater - maxDrawdown
  return lockAtStart ? Math.min(floor, start) : floor
}

export const topstepProfile: RuleProfile = {
  key: 'topstep',
  label: 'Topstep',
  evaluate(input: EvaluateInput): EvaluateResult {
    const { startingBalance: start, config, trades, todayDate } = input
    const { maxDrawdown, dailyLossLimit, profitTarget, consistencyPct, drawdownLocksAtStart } = config
    const intraday = config.drawdownMode === 'INTRADAY_TRAILING'

    const days = groupByDay(trades)
    const events: PendingRuleEvent[] = []

    let highWater = start
    let balance = start
    let breached = false
    let bestDay = 0
    let todayRealized = 0

    for (const day of days) {
      for (const t of day.trades) {
        balance += t.netPnl
        if (intraday) highWater = Math.max(highWater, balance)
        const mll = mllFrom(highWater, maxDrawdown, start, drawdownLocksAtStart)
        if (!breached && balance <= mll) {
          breached = true
          events.push({
            type: 'TRAILING_DRAWDOWN',
            severity: 'BREACH',
            occurredAt: t.exitAt,
            balanceAtEvent: balance,
            thresholdAtEvent: mll,
            message: 'Account balance hit the trailing max loss limit.'
          })
        }
      }
      if (!intraday) highWater = Math.max(highWater, balance) // EOD peak

      if (day.realized > bestDay) bestDay = day.realized

      // Daily loss limit for this session
      const dayLoss = -day.realized // positive if a losing day
      if (dailyLossLimit > 0) {
        if (dayLoss >= dailyLossLimit) {
          events.push({
            type: 'DAILY_LOSS_LIMIT',
            severity: 'BREACH',
            occurredAt: day.trades.at(-1)?.exitAt ?? day.date,
            balanceAtEvent: balance,
            thresholdAtEvent: -dailyLossLimit,
            message: `Daily loss limit reached on ${day.date} (auto-liquidation for the session).`
          })
        } else if (dayLoss >= WARN_DLL_FRACTION * dailyLossLimit) {
          events.push({
            type: 'DAILY_LOSS_LIMIT',
            severity: 'WARN',
            occurredAt: day.trades.at(-1)?.exitAt ?? day.date,
            balanceAtEvent: balance,
            thresholdAtEvent: -dailyLossLimit,
            message: `Approaching daily loss limit on ${day.date} (${Math.round((dayLoss / dailyLossLimit) * 100)}%).`
          })
        }
      }

      if (day.date === todayDate) todayRealized = day.realized
    }

    const currentMLL = mllFrom(highWater, maxDrawdown, start, drawdownLocksAtStart)
    const buffer = balance - currentMLL
    const totalProfit = balance - start

    const meters: GuardrailMeter[] = []

    // 1. Trailing drawdown buffer (primary)
    meters.push({
      type: 'TRAILING_DRAWDOWN',
      label: 'Drawdown buffer',
      state: buffer <= 0 ? 'breach' : buffer < WARN_DD_FRACTION * maxDrawdown ? 'warn' : 'safe',
      value: Math.max(0, buffer),
      limit: maxDrawdown,
      headline: `${dollars(buffer)} to limit`,
      detail: `MLL ${dollars(currentMLL)} · peak ${dollars(highWater)}`
    })

    // 2. Daily loss limit (today)
    if (dailyLossLimit > 0) {
      const used = Math.max(0, -todayRealized)
      meters.push({
        type: 'DAILY_LOSS_LIMIT',
        label: 'Daily loss',
        state: used >= dailyLossLimit ? 'breach' : used >= WARN_DLL_FRACTION * dailyLossLimit ? 'warn' : 'safe',
        value: used,
        limit: dailyLossLimit,
        headline: `${signedDollars(todayRealized)} today`,
        detail: `limit ${dollars(dailyLossLimit)}`
      })
    }

    // 3. Profit target
    if (profitTarget > 0) {
      meters.push({
        type: 'PROFIT_TARGET',
        label: 'Profit target',
        state: 'safe',
        value: Math.max(0, totalProfit),
        limit: profitTarget,
        headline: `${dollars(Math.max(0, totalProfit))} / ${dollars(profitTarget)}`,
        detail: totalProfit >= profitTarget ? 'target reached' : `${pct(totalProfit / profitTarget)}`
      })
    }

    // 4. Consistency
    if (consistencyPct != null && consistencyPct > 0) {
      const ratio = totalProfit > 0 ? bestDay / totalProfit : 0
      const minTotal = bestDay > 0 ? bestDay / consistencyPct : 0
      const violating = totalProfit > 0 && ratio > consistencyPct
      meters.push({
        type: 'CONSISTENCY',
        label: 'Consistency',
        state: violating ? 'warn' : 'safe',
        value: bestDay,
        limit: consistencyPct * Math.max(totalProfit, 1),
        headline: `best day ${pct(ratio)}`,
        detail: violating
          ? `need ${dollars(minTotal)} total (cap ${pct(consistencyPct)})`
          : `cap ${pct(consistencyPct)}`
      })
    }

    return {
      meters,
      events: events.slice(-100),
      highWaterBalance: highWater,
      currentMLL,
      currentBalance: balance
    }
  }
}

// tiny local formatters (kept dependency-free for testability)
function dollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`
}
function signedDollars(cents: number): string {
  const s = cents >= 0 ? '+' : '-'
  return `${s}$${Math.round(Math.abs(cents) / 100).toLocaleString('en-US')}`
}
function pct(f: number): string {
  return `${Math.round(f * 100)}%`
}
