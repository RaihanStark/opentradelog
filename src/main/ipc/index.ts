import { ipcMain, dialog, app, type BrowserWindow } from 'electron'
import { readFileSync } from 'fs'
import { IPC_CHANNELS } from '@shared/api'
import type { AccountInput, JournalUpsert, TradeJournalPatch } from '@shared/api'
import type { VaultManager } from '../vault/vault'
import { writeSettings } from '../settings'
import { createAccount, getRuleConfig, listAccounts } from '../core/accounts'
import { evaluateAccount } from '../core/rules'
import { importCsvIntoAccount, importFromVault } from '../core/import'
import { getDashboard } from '../core/dashboard'
import { getAnalytics, listTrades, updateTradeJournal } from '../core/trades'
import { getJournal, upsertJournal } from '../core/journal'
import type { AccountPhase } from '@shared/domain'

const now = (): string => new Date().toISOString()

export function registerIpc(vault: VaultManager, getWindow: () => BrowserWindow | null): void {
  const requireVault = (): void => {
    if (!vault.isOpen) throw new Error('No vault is open')
  }

  ipcMain.handle(IPC_CHANNELS.vaultStatus, () => vault.status())

  ipcMain.handle(IPC_CHANNELS.chooseVault, async () => {
    const win = getWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Choose or create your OpenTradeLog vault folder',
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || !res.filePaths[0]) return vault.status()
    const status = vault.open(res.filePaths[0])
    writeSettings({ lastVaultDir: res.filePaths[0] })
    return status
  })

  ipcMain.handle(IPC_CHANNELS.importVault, () => {
    requireVault()
    const r = importFromVault(vault.db, vault.dir!)
    vault.mirror()
    return r
  })

  ipcMain.handle(IPC_CHANNELS.listAccounts, () => {
    requireVault()
    return listAccounts(vault.db)
  })

  ipcMain.handle(IPC_CHANNELS.createAccount, (_e, input: AccountInput) => {
    requireVault()
    const acc = createAccount(vault.db, {
      name: input.name,
      firm: input.firm,
      phase: input.phase as AccountPhase,
      sizeLabel: input.sizeLabel,
      startingBalance: input.startingBalance,
      brokerAccountId: input.brokerAccountId ?? null
    })
    vault.mirror()
    return acc
  })

  ipcMain.handle(IPC_CHANNELS.getRuleConfig, (_e, accountId: string) => {
    requireVault()
    return getRuleConfig(vault.db, accountId)
  })

  ipcMain.handle(IPC_CHANNELS.getRuleStatus, (_e, accountId: string) => {
    requireVault()
    return evaluateAccount(vault.db, accountId, now())
  })

  ipcMain.handle(IPC_CHANNELS.importCsv, async (_e, accountId: string) => {
    requireVault()
    const win = getWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Import fills CSV',
      properties: ['openFile'],
      filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }]
    })
    if (res.canceled || !res.filePaths[0]) return null
    const text = readFileSync(res.filePaths[0], 'utf8')
    const result = importCsvIntoAccount(vault.db, accountId, text)
    evaluateAccount(vault.db, accountId, now())
    vault.mirror()
    return result
  })

  ipcMain.handle(IPC_CHANNELS.getDashboard, () => {
    requireVault()
    return getDashboard(vault.db, now())
  })

  ipcMain.handle(IPC_CHANNELS.listTrades, (_e, accountId?: string) => {
    requireVault()
    return listTrades(vault.db, accountId)
  })

  ipcMain.handle(IPC_CHANNELS.updateTrade, (_e, id: string, patch: TradeJournalPatch) => {
    requireVault()
    const t = updateTradeJournal(vault.db, id, patch)
    vault.mirror()
    return t
  })

  ipcMain.handle(IPC_CHANNELS.getAnalytics, (_e, accountId?: string) => {
    requireVault()
    return getAnalytics(vault.db, accountId)
  })

  ipcMain.handle(IPC_CHANNELS.getJournal, (_e, accountId: string, tradingDate: string) => {
    requireVault()
    return getJournal(vault.db, accountId, tradingDate)
  })

  ipcMain.handle(IPC_CHANNELS.upsertJournal, (_e, payload: JournalUpsert) => {
    requireVault()
    const j = upsertJournal(vault.db, payload)
    vault.mirror()
    return j
  })
}
