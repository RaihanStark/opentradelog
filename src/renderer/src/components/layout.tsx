import { NavLink } from 'react-router-dom'
import { BarChart3, BookOpen, LayoutDashboard, ListOrdered, Moon, Settings, Sun, Wallet } from 'lucide-react'
import { useApp } from '../lib/app-context'
import { cn } from '../lib/utils'
import { Button } from './ui'

const NAV = [
  { to: '/', label: 'Dash', icon: LayoutDashboard, end: true },
  { to: '/trades', label: 'Trades', icon: ListOrdered },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/analytics', label: 'Stats', icon: BarChart3 },
  { to: '/accounts', label: 'Accts', icon: Wallet },
  { to: '/settings', label: 'Config', icon: Settings }
]

export function Rail(): React.JSX.Element {
  return (
    <nav className="flex w-16 flex-col items-center gap-1 border-r border-border bg-panel py-3">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded bg-accent text-sm font-bold text-accent-fg">
        O
      </div>
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex w-14 flex-col items-center gap-1 rounded py-2 text-[10px] font-medium transition-colors',
              isActive ? 'bg-panel-2 text-accent' : 'text-fg-subtle hover:bg-panel-2 hover:text-fg'
            )
          }
        >
          <Icon size={17} strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export function CommandBar(): React.JSX.Element {
  const { accounts, selectedAccountId, setSelectedAccountId, theme, toggleTheme, vault } = useApp()

  return (
    <header className="drag flex h-11 items-center gap-3 border-b border-border bg-panel px-3">
      <span className="text-[13px] font-semibold tracking-tight">
        OpenTradeLog
      </span>
      <div className="no-drag flex items-center gap-2">
        <select
          value={selectedAccountId ?? ''}
          onChange={(e) => setSelectedAccountId(e.target.value || null)}
          className="h-7 rounded border border-border-strong bg-panel-2 px-2 text-xs text-fg focus:outline-none"
        >
          {accounts.length === 0 && <option value="">No accounts</option>}
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1" />
      {vault.dir && (
        <span className="num hidden truncate text-[10px] text-fg-subtle md:block" title={vault.dir}>
          {vault.dir}
        </span>
      )}
      <Button variant="ghost" size="sm" onClick={toggleTheme} className="no-drag">
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </Button>
    </header>
  )
}
