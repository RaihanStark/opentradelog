import { useState } from 'react'
import { Sparkles, Upload } from 'lucide-react'
import type { AccountInput } from '@shared/api'
import type { AccountPhase } from '@shared/domain'
import { formatUSD } from '@shared/money'
import { useApp } from '../lib/app-context'
import { otl } from '../lib/utils'
import { Button, Panel } from '../components/ui'

const SIZES = ['50K', '100K', '150K']

export function Accounts(): React.JSX.Element {
  const { accounts, refreshAccounts } = useApp()
  const [form, setForm] = useState<AccountInput>({
    name: '',
    firm: 'topstep',
    phase: 'COMBINE',
    sizeLabel: '50K'
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const submit = async (): Promise<void> => {
    if (!form.name.trim()) return
    setBusy(true)
    await otl().createAccount(form)
    await refreshAccounts()
    setForm({ ...form, name: '' })
    setBusy(false)
  }

  const importCsv = async (id: string): Promise<void> => {
    const res = await otl().importCsv(id)
    if (res) {
      setMsg(`Imported ${res.received} fills → ${res.trades} trades (${res.inserted} new, ${res.skipped} skipped).`)
      await refreshAccounts()
    }
  }

  const loadDemo = async (): Promise<void> => {
    setBusy(true)
    const res = await otl().loadDemo()
    setMsg(res.loaded ? `Loaded ${res.accounts} demo accounts with journaled trades.` : 'Demo data already loaded.')
    await refreshAccounts()
    setBusy(false)
  }

  const field = 'h-8 rounded border border-border-strong bg-panel-2 px-2 text-[13px] text-fg focus:outline-none'

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Panel label="New account">
        <div className="space-y-2">
          <input
            className={`${field} w-full`}
            placeholder="Account name (e.g. Combine 50K #1)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-2">
            <select className={field} value={form.firm} onChange={(e) => setForm({ ...form, firm: e.target.value })}>
              <option value="topstep">Topstep</option>
              <option value="none">Retail / none</option>
            </select>
            <select
              className={field}
              value={form.phase}
              onChange={(e) => setForm({ ...form, phase: e.target.value as AccountPhase })}
            >
              <option value="COMBINE">Combine</option>
              <option value="EXPRESS_FUNDED">Express Funded</option>
              <option value="LIVE_FUNDED">Live Funded</option>
              <option value="RETAIL">Retail</option>
            </select>
            <select
              className={field}
              value={form.sizeLabel}
              onChange={(e) => setForm({ ...form, sizeLabel: e.target.value })}
            >
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <Button variant="primary" onClick={submit} disabled={busy || !form.name.trim()}>
            Create account
          </Button>
          <p className="text-[11px] text-fg-subtle">
            Topstep accounts auto-fill profit target, trailing max loss, daily loss limit, and the consistency rule
            from the size preset.
          </p>
          <div className="mt-1 flex items-center gap-2 border-t border-border pt-2">
            <Button variant="default" size="sm" onClick={loadDemo} disabled={busy}>
              <Sparkles size={13} /> Load demo data
            </Button>
            <span className="text-[11px] text-fg-subtle">
              Fills 3 example accounts with journaled trades to explore every feature.
            </span>
          </div>
        </div>
      </Panel>

      <Panel label={`Accounts (${accounts.length})`}>
        {accounts.length === 0 ? (
          <div className="py-6 text-center text-sm text-fg-muted">No accounts yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-[13px] font-medium">{a.name}</div>
                  <div className="num text-[11px] text-fg-subtle">
                    {a.firm} · {a.phase} · {a.sizeLabel} · start {formatUSD(a.startingBalance, { cents: false })}
                  </div>
                </div>
                <Button size="sm" onClick={() => importCsv(a.id)}>
                  <Upload size={13} /> Import CSV
                </Button>
              </div>
            ))}
          </div>
        )}
        {msg && <div className="mt-2 rounded border border-border bg-panel-2 px-2 py-1 text-[11px] text-fg-muted">{msg}</div>}
      </Panel>
    </div>
  )
}
