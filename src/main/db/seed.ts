import type { DB } from './client'
import { instruments } from './schema'
import { newId } from './ids'

/** symbol, tickSize, tickValue(cents), pointValue(cents) */
const INSTRUMENTS: [string, number, number, number][] = [
  ['ES', 0.25, 1250, 5000],
  ['MES', 0.25, 125, 500],
  ['NQ', 0.25, 500, 2000],
  ['MNQ', 0.25, 50, 200],
  ['YM', 1, 500, 500],
  ['MYM', 1, 50, 50],
  ['RTY', 0.1, 500, 5000],
  ['M2K', 0.1, 50, 500],
  ['CL', 0.01, 1000, 100000],
  ['MCL', 0.01, 100, 10000],
  ['GC', 0.1, 1000, 10000],
  ['MGC', 0.1, 100, 1000],
  ['NG', 0.001, 1000, 1000000],
  ['6E', 0.00005, 625, 12500000]
]

export function seedInstruments(db: DB): void {
  for (const [symbol, tickSize, tickValue, pointValue] of INSTRUMENTS) {
    db.insert(instruments)
      .values({ id: newId('ins'), symbol, contractId: null, tickSize, tickValue, pointValue })
      .onConflictDoNothing({ target: instruments.symbol })
      .run()
  }
}
