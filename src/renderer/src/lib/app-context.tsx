import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { Account } from '@shared/domain'
import type { VaultStatus } from '@shared/api'
import { otl } from './utils'

type Theme = 'dark' | 'light'

interface AppState {
  vault: VaultStatus
  loadingVault: boolean
  chooseVault: () => Promise<void>
  accounts: Account[]
  selectedAccountId: string | null
  setSelectedAccountId: (id: string | null) => void
  refreshAccounts: () => Promise<void>
  theme: Theme
  toggleTheme: () => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [vault, setVault] = useState<VaultStatus>({ open: false, dir: null })
  const [loadingVault, setLoadingVault] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('otl-theme') as Theme) || 'dark'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('otl-theme', theme)
  }, [theme])

  const refreshAccounts = useCallback(async () => {
    const list = await otl().listAccounts()
    setAccounts(list)
    setSelectedAccountId((prev) => prev ?? list[0]?.id ?? null)
  }, [])

  const loadVault = useCallback(async () => {
    setLoadingVault(true)
    const status = await otl().vaultStatus()
    setVault(status)
    if (status.open) await refreshAccounts()
    setLoadingVault(false)
  }, [refreshAccounts])

  useEffect(() => {
    void loadVault()
  }, [loadVault])

  const chooseVault = useCallback(async () => {
    const status = await otl().chooseVault()
    setVault(status)
    if (status.open) await refreshAccounts()
  }, [refreshAccounts])

  const value = useMemo<AppState>(
    () => ({
      vault,
      loadingVault,
      chooseVault,
      accounts,
      selectedAccountId,
      setSelectedAccountId,
      refreshAccounts,
      theme,
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
    }),
    [vault, loadingVault, chooseVault, accounts, selectedAccountId, refreshAccounts, theme]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used within AppProvider')
  return v
}
