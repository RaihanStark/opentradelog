/** Portfolio analytics computed from closed trades (pure, testable). */
import type { AnalyticsSummary, EquityPoint } from '@shared/domain'

export interface AnalyticsTrade {
  netPnl: number // cents
  rMultiple: number | null
  exitAt: string
  symbol: string
  setupTag: string | null
}

export type { AnalyticsSummary, EquityPoint }

export function computeAnalytics(tradesIn: AnalyticsTrade[]): AnalyticsSummary {
  const trades = [...tradesIn].sort((a, b) => (a.exitAt < b.exitAt ? -1 : a.exitAt > b.exitAt ? 1 : 0))

  let wins = 0
  let losses = 0
  let grossProfit = 0
  let grossLoss = 0
  let netPnl = 0
  let rSum = 0
  let rCount = 0

  let equity = 0
  let peak = 0
  let maxDrawdown = 0
  const equityCurve: EquityPoint[] = []

  const symbolMap = new Map<string, { netPnl: number; trades: number }>()
  const setupMap = new Map<string, { netPnl: number; trades: number }>()

  for (const t of trades) {
    netPnl += t.netPnl
    if (t.netPnl > 0) {
      wins++
      grossProfit += t.netPnl
    } else if (t.netPnl < 0) {
      losses++
      grossLoss += t.netPnl
    }
    if (t.rMultiple != null && !Number.isNaN(t.rMultiple)) {
      rSum += t.rMultiple
      rCount++
    }

    equity += t.netPnl
    peak = Math.max(peak, equity)
    const dd = equity - peak
    maxDrawdown = Math.max(maxDrawdown, -dd)
    equityCurve.push({ t: t.exitAt, equity, drawdown: dd })

    const sym = symbolMap.get(t.symbol) ?? { netPnl: 0, trades: 0 }
    sym.netPnl += t.netPnl
    sym.trades++
    symbolMap.set(t.symbol, sym)

    const setupKey = t.setupTag ?? 'untagged'
    const setup = setupMap.get(setupKey) ?? { netPnl: 0, trades: 0 }
    setup.netPnl += t.netPnl
    setup.trades++
    setupMap.set(setupKey, setup)
  }

  const tradeCount = trades.length
  const decided = wins + losses

  return {
    tradeCount,
    wins,
    losses,
    winRate: decided > 0 ? wins / decided : 0,
    netPnl,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss < 0 ? grossProfit / -grossLoss : grossProfit > 0 ? null : null,
    avgWin: wins > 0 ? Math.round(grossProfit / wins) : 0,
    avgLoss: losses > 0 ? Math.round(grossLoss / losses) : 0,
    expectancy: tradeCount > 0 ? Math.round(netPnl / tradeCount) : 0,
    avgR: rCount > 0 ? rSum / rCount : null,
    maxDrawdown,
    equityCurve,
    bySymbol: [...symbolMap.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.netPnl - a.netPnl),
    bySetup: [...setupMap.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.netPnl - a.netPnl)
  }
}
