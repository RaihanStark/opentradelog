import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type OtlApi } from '@shared/api'

const otl: OtlApi = {
  vaultStatus: () => ipcRenderer.invoke(IPC_CHANNELS.vaultStatus),
  chooseVault: () => ipcRenderer.invoke(IPC_CHANNELS.chooseVault),
  importVault: () => ipcRenderer.invoke(IPC_CHANNELS.importVault),
  loadDemo: () => ipcRenderer.invoke(IPC_CHANNELS.loadDemo),
  listAccounts: () => ipcRenderer.invoke(IPC_CHANNELS.listAccounts),
  createAccount: (input) => ipcRenderer.invoke(IPC_CHANNELS.createAccount, input),
  getRuleConfig: (id) => ipcRenderer.invoke(IPC_CHANNELS.getRuleConfig, id),
  getRuleStatus: (id) => ipcRenderer.invoke(IPC_CHANNELS.getRuleStatus, id),
  importCsv: (id) => ipcRenderer.invoke(IPC_CHANNELS.importCsv, id),
  getDashboard: () => ipcRenderer.invoke(IPC_CHANNELS.getDashboard),
  listTrades: (id) => ipcRenderer.invoke(IPC_CHANNELS.listTrades, id),
  updateTrade: (id, patch) => ipcRenderer.invoke(IPC_CHANNELS.updateTrade, id, patch),
  getAnalytics: (id) => ipcRenderer.invoke(IPC_CHANNELS.getAnalytics, id),
  getJournal: (id, date) => ipcRenderer.invoke(IPC_CHANNELS.getJournal, id, date),
  upsertJournal: (p) => ipcRenderer.invoke(IPC_CHANNELS.upsertJournal, p)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('otl', otl)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (defined in index.d.ts)
  window.otl = otl
}
