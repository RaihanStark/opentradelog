import { mkdirSync } from 'fs'
import { join } from 'path'
import { openDatabase, type OpenDb, type DB } from '../db/client'
import { seedInstruments } from '../db/seed'
import { writeMirror } from './mirror'
import type { VaultStatus } from '@shared/api'

/** Owns the currently-open vault (its SQLite db + folder) for the main process. */
export class VaultManager {
  private current: { dir: string; open: OpenDb } | null = null

  constructor(private migrationsFolder: string) {}

  get isOpen(): boolean {
    return this.current != null
  }

  get dir(): string | null {
    return this.current?.dir ?? null
  }

  get db(): DB {
    if (!this.current) throw new Error('No vault is open')
    return this.current.open.db
  }

  status(): VaultStatus {
    return { open: this.isOpen, dir: this.dir }
  }

  open(dir: string): VaultStatus {
    this.current?.open.close()
    mkdirSync(dir, { recursive: true })
    mkdirSync(join(dir, 'attachments'), { recursive: true })
    const open = openDatabase(join(dir, 'journal.sqlite'), this.migrationsFolder)
    seedInstruments(open.db)
    this.current = { dir, open }
    this.mirror()
    return this.status()
  }

  /** Re-export the open-format mirror. Call after any mutation. */
  mirror(): void {
    if (this.current) writeMirror(this.current.open.db, this.current.dir, new Date().toISOString())
  }

  close(): void {
    this.current?.open.close()
    this.current = null
  }
}
