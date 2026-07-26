import { useEffect, useState } from 'react'
import type { Trade } from '@shared/domain'
import type { TradeJournalPatch } from '@shared/api'
import { formatPrice, formatR, formatUSD } from '@shared/money'
import { useApp } from '../lib/app-context'
import { otl } from '../lib/utils'
import { Button, Empty, Panel, PnL } from '../components/ui'
import { cn } from '../lib/utils'

export function Trades(): React.JSX.Element {
  const { selectedAccountId } = useApp()
  const [trades, setTrades] = useState<Trade[]>([])
  const [selected, setSelected] = useState<Trade | null>(null)

  const load = async (): Promise<void> => {
    const t = await otl().listTrades(selectedAccountId ?? undefined)
    setTrades(t)
    setSelected((prev) => (prev ? t.find((x) => x.id === prev.id) ?? null : null))
  }
  useEffect(() => {
    void load()
  }, [selectedAccountId])

  return (
    <div className={cn('grid gap-3', selected ? 'grid-cols-[1fr_320px]' : 'grid-cols-1')}>
      <Panel label={`Trade log (${trades.length})`}>
        {trades.length === 0 ? (
          <Empty>No trades. Import fills from the Accounts tab.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="panel-label border-b border-border [&>th]:px-2 [&>th]:py-1.5 [&>th]:font-semibold">
                  <th>Date</th>
                  <th>Sym</th>
                  <th>Dir</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Entry</th>
                  <th className="text-right">Exit</th>
                  <th className="text-right">R</th>
                  <th className="text-right">Net</th>
                  <th>Setup</th>
                </tr>
              </thead>
              <tbody className="num">
                {trades.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className={cn(
                      'cursor-pointer border-b border-border/60 hover:bg-panel-2 [&>td]:px-2 [&>td]:py-1.5',
                      selected?.id === t.id && 'bg-panel-2'
                    )}
                  >
                    <td className="text-fg-subtle">{t.sessionDate}</td>
                    <td className="font-medium text-fg">{t.symbol}</td>
                    <td className={t.direction === 'LONG' ? 'text-profit' : 'text-loss'}>
                      {t.direction === 'LONG' ? 'LONG' : 'SHORT'}
                    </td>
                    <td className="text-right">{t.qty}</td>
                    <td className="text-right">{formatPrice(t.avgEntryPrice)}</td>
                    <td className="text-right">{t.avgExitPrice != null ? formatPrice(t.avgExitPrice) : '—'}</td>
                    <td className={cn('text-right', (t.rMultiple ?? 0) >= 0 ? 'text-profit' : 'text-loss')}>
                      {formatR(t.rMultiple)}
                    </td>
                    <td className="text-right">
                      <PnL cents={t.netPnl} sign={false} />
                    </td>
                    <td className="text-fg-subtle">{t.setupTag ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {selected && <TradeEditor trade={selected} onClose={() => setSelected(null)} onSaved={load} />}
    </div>
  )
}

function TradeEditor({
  trade,
  onClose,
  onSaved
}: {
  trade: Trade
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [patch, setPatch] = useState<TradeJournalPatch>({})
  const val = <K extends keyof TradeJournalPatch>(k: K): TradeJournalPatch[K] =>
    (patch[k] ?? (trade[k as keyof Trade] as TradeJournalPatch[K]))

  const save = async (): Promise<void> => {
    await otl().updateTrade(trade.id, patch)
    setPatch({})
    onSaved()
  }

  const field = 'h-8 w-full rounded border border-border-strong bg-panel-2 px-2 text-[13px] focus:outline-none'

  return (
    <Panel
      label={`${trade.symbol} · ${trade.direction}`}
      right={
        <button onClick={onClose} className="text-fg-subtle hover:text-fg">
          ✕
        </button>
      }
    >
      <div className="space-y-3">
        <div className="num grid grid-cols-2 gap-2 text-xs">
          <Info label="Net P&L" value={formatUSD(trade.netPnl, { sign: true })} />
          <Info label="R" value={formatR(trade.rMultiple)} />
          <Info label="Qty" value={String(trade.qty)} />
          <Info label="Fees" value={formatUSD(trade.fees)} />
        </div>

        <Labeled label="Setup / strategy">
          <input
            className={field}
            value={(val('setupTag') as string) ?? ''}
            onChange={(e) => setPatch({ ...patch, setupTag: e.target.value })}
          />
        </Labeled>
        <div className="grid grid-cols-2 gap-2">
          <Labeled label="Discipline 1–5">
            <input
              type="number"
              min={1}
              max={5}
              className={field}
              value={(val('disciplineScore') as number) ?? ''}
              onChange={(e) => setPatch({ ...patch, disciplineScore: e.target.value ? Number(e.target.value) : null })}
            />
          </Labeled>
          <Labeled label="Rule adherence 1–5">
            <input
              type="number"
              min={1}
              max={5}
              className={field}
              value={(val('ruleAdherence') as number) ?? ''}
              onChange={(e) => setPatch({ ...patch, ruleAdherence: e.target.value ? Number(e.target.value) : null })}
            />
          </Labeled>
        </div>
        <Labeled label="Mood">
          <input
            className={field}
            value={(val('mood') as string) ?? ''}
            onChange={(e) => setPatch({ ...patch, mood: e.target.value })}
          />
        </Labeled>
        <Labeled label="Planned stop (price) — sets risk & R">
          <input
            type="number"
            step="0.01"
            className={field}
            value={(val('plannedStop') as number) ?? ''}
            onChange={(e) => setPatch({ ...patch, plannedStop: e.target.value ? Number(e.target.value) : null })}
          />
        </Labeled>
        <Labeled label="Notes">
          <textarea
            rows={4}
            className="w-full rounded border border-border-strong bg-panel-2 p-2 text-[13px] focus:outline-none"
            value={(val('notes') as string) ?? ''}
            onChange={(e) => setPatch({ ...patch, notes: e.target.value })}
          />
        </Labeled>
        <Button variant="primary" onClick={save} disabled={Object.keys(patch).length === 0}>
          Save journaling
        </Button>
      </div>
    </Panel>
  )
}

function Info({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded border border-border bg-panel-2 px-2 py-1">
      <div className="panel-label">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="block space-y-1">
      <span className="panel-label">{label}</span>
      {children}
    </label>
  )
}
