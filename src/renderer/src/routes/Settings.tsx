import { useState } from 'react'
import { FolderOpen, RotateCcw } from 'lucide-react'
import { useApp } from '../lib/app-context'
import { otl } from '../lib/utils'
import { Button, Panel } from '../components/ui'

export function Settings(): React.JSX.Element {
  const { vault, chooseVault, refreshAccounts } = useApp()
  const [msg, setMsg] = useState<string | null>(null)

  const rebuild = async (): Promise<void> => {
    const r = await otl().importVault()
    setMsg(`Rebuilt from vault: ${r.accounts} accounts, ${r.executions} executions.`)
    await refreshAccounts()
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Panel label="Vault">
        <div className="space-y-2 text-[13px]">
          <div>
            <div className="panel-label mb-1">Current vault folder</div>
            <div className="num break-all rounded border border-border bg-panel-2 px-2 py-1 text-xs text-fg-muted">
              {vault.dir ?? 'none'}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={chooseVault}>
              <FolderOpen size={14} /> Change vault
            </Button>
            <Button onClick={rebuild}>
              <RotateCcw size={14} /> Rebuild from vault files
            </Button>
          </div>
          {msg && <div className="rounded border border-border bg-panel-2 px-2 py-1 text-[11px] text-fg-muted">{msg}</div>}
        </div>
      </Panel>

      <Panel label="Your data is yours">
        <div className="space-y-2 text-[12px] text-fg-muted">
          <p>
            Everything lives in your vault folder as open, documented formats — <code className="num">journal.sqlite</code>{' '}
            plus a continuously-mirrored <code className="num">export/</code> folder of Markdown journals, CSV trades,
            and JSONL fills.
          </p>
          <p>
            Put the folder in Dropbox / iCloud / git to back it up. If OpenTradeLog ever disappears, your entire
            journal remains readable in any editor — and <em>Rebuild from vault files</em> reconstructs the database
            losslessly from the exports.
          </p>
          <p className="text-fg-subtle">No account. No cloud. No telemetry. MIT-licensed and open source.</p>
        </div>
      </Panel>
    </div>
  )
}
