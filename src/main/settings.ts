import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

/** Tiny JSON settings file in userData (last vault path, theme). */
export interface AppSettings {
  lastVaultDir?: string
  theme?: 'dark' | 'light'
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function readSettings(): AppSettings {
  try {
    const p = settingsPath()
    if (!existsSync(p)) return {}
    return JSON.parse(readFileSync(p, 'utf8')) as AppSettings
  } catch {
    return {}
  }
}

export function writeSettings(patch: Partial<AppSettings>): AppSettings {
  const merged = { ...readSettings(), ...patch }
  writeFileSync(settingsPath(), JSON.stringify(merged, null, 2))
  return merged
}
