import { Route, Routes } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import { useApp } from './lib/app-context'
import { CommandBar, Rail } from './components/layout'
import { Button } from './components/ui'
import { Dashboard } from './routes/Dashboard'
import { Trades } from './routes/Trades'
import { Journal } from './routes/Journal'
import { Analytics } from './routes/Analytics'
import { Accounts } from './routes/Accounts'
import { Settings } from './routes/Settings'

function Onboarding(): React.JSX.Element {
  const { chooseVault } = useApp()
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md space-y-4 rounded-lg border border-border bg-panel p-6 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded bg-accent text-lg font-bold text-accent-fg">
          O
        </div>
        <h1 className="text-lg font-semibold">Welcome to OpenTradeLog</h1>
        <p className="text-sm text-fg-muted">
          Choose a folder to be your <strong>vault</strong> — your entire trading journal lives there in open,
          portable formats that you own. Put it in Dropbox or git to back it up.
        </p>
        <Button variant="primary" onClick={chooseVault} className="mx-auto">
          <FolderOpen size={15} /> Choose vault folder
        </Button>
      </div>
    </div>
  )
}

export default function App(): React.JSX.Element {
  const { vault, loadingVault } = useApp()

  if (loadingVault) {
    return <div className="flex h-full items-center justify-center text-sm text-fg-muted">Loading…</div>
  }

  if (!vault.open) return <Onboarding />

  return (
    <div className="flex h-full">
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col">
        <CommandBar />
        <main className="flex-1 overflow-y-auto p-3">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
