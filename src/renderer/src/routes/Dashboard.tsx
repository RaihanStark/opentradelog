import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Sparkles } from 'lucide-react'
import type { DashboardAccount } from '@shared/api'
import { formatPct } from '@shared/money'
import { useApp } from '../lib/app-context'
import { otl } from '../lib/utils'
import { Button, Meter, Panel, PnL, Stat } from '../components/ui'
import { EquityChart } from '../components/EquityChart'

export function Dashboard(): React.JSX.Element {
  const { selectedAccountId, accounts, refreshAccounts } = useApp()
  const [data, setData] = useState<DashboardAccount[]>([])
  const [loading, setLoading] = useState(true)

  const load = async (): Promise<void> => {
    setLoading(true)
    setData(await otl().getDashboard())
    setLoading(false)
  }
  useEffect(() => {
    void load()
  }, [accounts.length])

  const loadDemo = async (): Promise<void> => {
    await otl().loadDemo()
    await refreshAccounts()
    await load()
  }

  const shown = selectedAccountId ? data.filter((d) => d.account.id === selectedAccountId) : data

  if (!loading && accounts.length === 0) {
    return (
      <Panel label="Get started">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-fg-muted">
            No accounts yet. Create one in{' '}
            <Link to="/accounts" className="text-accent underline">
              Accounts
            </Link>{' '}
            and import your fills — or load the demo to explore every feature.
          </p>
          <Button variant="primary" onClick={loadDemo}>
            <Sparkles size={15} /> Load demo data
          </Button>
        </div>
      </Panel>
    )
  }

  const agg = shown.reduce(
    (a, d) => ({
      net: a.net + d.netPnl,
      today: a.today + d.todayPnl,
      trades: a.trades + d.tradeCount
    }),
    { net: 0, today: 0, trades: 0 }
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex divide-x divide-border rounded-md border border-border bg-panel">
          <Stat label="Net P&L">
            <PnL cents={agg.net} bold />
          </Stat>
          <Stat label="Today">
            <PnL cents={agg.today} bold />
          </Stat>
          <Stat label="Trades">{agg.trades}</Stat>
        </div>
        <Button variant="default" size="sm" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      {shown.map((d) => (
        <Panel
          key={d.account.id}
          label={`${d.account.name} · ${d.account.phase} · ${d.account.sizeLabel}`}
          right={
            <div className="num flex items-center gap-3 text-xs">
              <span className="text-fg-subtle">win {formatPct(d.winRate)}</span>
              <PnL cents={d.netPnl} />
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div className="space-y-3">
              {d.ruleStatus.meters.length === 0 ? (
                <div className="text-xs text-fg-subtle">No guardrails (retail profile).</div>
              ) : (
                d.ruleStatus.meters.map((m) => <Meter key={m.type} meter={m} />)
              )}
              {d.ruleStatus.events.some((e) => e.severity === 'BREACH') && (
                <div className="rounded border border-breach/40 bg-breach/10 px-2 py-1 text-[11px] text-breach">
                  {d.ruleStatus.events.find((e) => e.severity === 'BREACH')?.message}
                </div>
              )}
            </div>
            <div>
              <EquityChart data={d.equityCurve} />
              <div className="mt-2 divide-y divide-border border-t border-border">
                {d.recentTrades.length === 0 ? (
                  <div className="py-3 text-center text-xs text-fg-subtle">No trades imported</div>
                ) : (
                  d.recentTrades.slice(0, 6).map((t) => (
                    <Link
                      key={t.id}
                      to={`/trades`}
                      className="num flex items-center justify-between py-1.5 text-xs hover:text-accent"
                    >
                      <span className="flex gap-2">
                        <span className="w-10 text-fg">{t.symbol}</span>
                        <span className={t.direction === 'LONG' ? 'text-profit' : 'text-loss'}>
                          {t.direction === 'LONG' ? 'L' : 'S'} {t.qty}
                        </span>
                        <span className="text-fg-subtle">{t.sessionDate}</span>
                      </span>
                      <PnL cents={t.netPnl} sign={false} />
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </Panel>
      ))}
    </div>
  )
}
