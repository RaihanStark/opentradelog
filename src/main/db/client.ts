import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

export type DB = BetterSQLite3Database<typeof schema>

export interface OpenDb {
  db: DB
  sqlite: Database.Database
  close: () => void
}

/**
 * Open (or create) a vault SQLite database and bring it up to schema.
 * `migrationsFolder` is the bundled ./drizzle folder.
 */
export function openDatabase(dbPath: string, migrationsFolder: string): OpenDb {
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder })
  return { db, sqlite, close: () => sqlite.close() }
}

export { schema }
