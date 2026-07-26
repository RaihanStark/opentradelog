import { useEffect, useState } from 'react'
import type { AnalyticsSummary } from '@shared/domain'
import { formatPct, formatUSD } from '@shared/money'
import { useApp } from '../lib/app-context'
import { otl } from '../lib/utils'
import { Empty, Panel, PnL, Stat } from '../components/ui'
import { EquityChart } from '../components/EquityChart'

export function Analytics(): React.JSX.Element {
  const { selectedAccountId } = useApp()
  const [a, setA] = useState<AnalyticsSummary | null>(null)

  useEffect(() => {
    void otl()
      .getAnalytics(selectedAccountId ?? undefined)
      .then(setA)
  }, [selectedAccountId])

  if (!a) return <Empty>Loading…</Empty>
  if (a.tradeCount === 0)
    return (
      <Panel label="Analytics">
        <Empty>No closed trades yet. Import fills to see your stats.</Empty>
      </Panel>
    )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 divide-x divide-border rounded-md border border-border bg-panel md:grid-cols-6">
        <Stat label="Net P&L">
          <PnL cents={a.netPnl} bold />
        </Stat>
        <Stat label="Win rate">{formatPct(a.winRate)}</Stat>
        <Stat label="Expectancy">
          <PnL cents={a.expectancy} />
        </Stat>
        <Stat label="Avg R">{a.avgR != null ? `${a.avgR.toFixed(2)}R` : '—'}</Stat>
        <Stat label="Profit factor">{a.profitFactor != null ? a.profitFactor.toFixed(2) : '—'}</Stat>
        <Stat label="Max DD">{formatUSD(-a.maxDrawdown)}</Stat>
      </div>

      <Panel label="Equity curve">
        <EquityChart data={a.equityCurve.map((p) => ({ t: p.t, equity: p.equity }))} height={220} />
      </Panel>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Breakdown title="By symbol" rows={a.bySymbol} />
        <Breakdown title="By setup" rows={a.bySetup} />
      </div>
    </div>
  )
}

function Breakdown({
  title,
  rows
}: {
  title: string
  rows: { key: string; netPnl: number; trades: number }[]
}): React.JSX.Element {
  return (
    <Panel label={title}>
      {rows.length === 0 ? (
        <Empty>No data</Empty>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r) => (
            <div key={r.key} className="num flex items-center justify-between py-1.5 text-[13px]">
              <span className="text-fg">{r.key}</span>
              <span className="flex items-center gap-3">
                <span className="text-fg-subtle">{r.trades}t</span>
                <PnL cents={r.netPnl} sign={false} />
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
