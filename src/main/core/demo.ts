import type { DB } from '../db/client'
import type { AccountPhase, RawExecution } from '@shared/domain'
import { createAccount, listAccounts } from './accounts'
import { ingestExecutions, tradeIdFor } from './ingest'
import { updateTradeJournal } from './trades'
import { upsertJournal } from './journal'

/**
 * Load a realistic, fully-journaled demo dataset so every screen is populated.
 * Deterministic (seeded LCG, no Math.random / Date.now) and idempotent — it
 * no-ops if the demo accounts already exist. Fills flow through the real
 * ingest pipeline, so trades/analytics/guardrails are all genuine.
 */

const DEMO_TAG = '(demo)'

// seeded pseudo-random for reproducibility
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

const SYMBOLS: Record<string, { pv: number; base: number }> = {
  MES: { pv: 500, base: 5000 },
  MNQ: { pv: 200, base: 18000 }
}

const WIN_MOODS = ['calm', 'focused', 'patient', 'in the zone']
const LOSS_MOODS = ['anxious', 'frustrated', 'impatient', 'tilted']
const SETUPS = ['ORB', 'VWAP reclaim', 'Trend pullback', 'Failed breakout', 'Range fade', 'News spike']
const WIN_NOTES = [
  'Waited for confirmation, took profit into resistance. Textbook.',
  'Followed the plan, scaled out at target. Clean execution.',
  'Good entry off the level, managed risk well.',
  'Patient wait paid off — let it run to target.'
]
const LOSS_NOTES = [
  'Chased the entry, stop hit. Should have waited.',
  'Fought the trend. Cut it, moved on.',
  'Sized too big for the setup. Respected the stop.',
  'Entered on emotion after a miss. Note the tilt.'
]

interface AccountSpec {
  name: string
  firm: string
  phase: AccountPhase
  sizeLabel: string
  seed: number
  startDate: string // first business day, YYYY-MM-DD (a Monday)
  dayTargets: number[] // cents per business day
}

const SPECS: AccountSpec[] = [
  {
    name: `Combine 50K ${DEMO_TAG}`,
    firm: 'topstep',
    phase: 'COMBINE',
    sizeLabel: '50K',
    seed: 101,
    startDate: '2026-06-08',
    dayTargets: [
      22000, 34000, -18000, 41000, 15000, -82000, 26000, 18000, 52000, -14000, 135000, -26000,
      18000, 9000, 24000, -11000, 16000
    ]
  },
  {
    name: `Express Funded 50K ${DEMO_TAG}`,
    firm: 'topstep',
    phase: 'EXPRESS_FUNDED',
    sizeLabel: '50K',
    seed: 202,
    startDate: '2026-06-15',
    dayTargets: [12000, 8000, -16000, 22000, 9000, -9000, 18000, 11000, 26000, -11000]
  },
  {
    name: `Retail (NQ swing) ${DEMO_TAG}`,
    firm: 'none',
    phase: 'RETAIL',
    sizeLabel: '50K',
    seed: 303,
    startDate: '2026-06-22',
    dayTargets: [24000, -12000, 31000, 9000, -8000, 18000]
  }
]

function nextBusinessDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + 1))
  const dow = dt.getUTCDay()
  if (dow === 6) dt.setUTCDate(dt.getUTCDate() + 2)
  else if (dow === 0) dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function splitDay(net: number, k: number, rnd: () => number): number[] {
  if (k <= 1) return [net]
  const base = Math.round(net / k)
  const parts: number[] = []
  let acc = 0
  for (let i = 0; i < k - 1; i++) {
    const delta = Math.round(base * 0.5 * (rnd() * 2 - 1))
    parts.push(base + delta)
    acc += base + delta
  }
  parts.push(net - acc)
  return parts
}

export function loadDemoData(db: DB): { accounts: number; loaded: boolean } {
  const existing = new Set(listAccounts(db).map((a) => a.name))
  if (SPECS.every((s) => existing.has(s.name))) return { accounts: 0, loaded: false }

  let created = 0

  for (const spec of SPECS) {
    if (existing.has(spec.name)) continue
    const account = createAccount(db, {
      name: spec.name,
      firm: spec.firm,
      phase: spec.phase,
      sizeLabel: spec.sizeLabel
    })
    created++

    const rnd = lcg(spec.seed)
    const execs: RawExecution[] = []
    const journalOps: { entryExecId: string; patch: Parameters<typeof updateTradeJournal>[2] }[] = []
    const days: { date: string; net: number }[] = []

    let date = spec.startDate
    let tIndex = 0

    for (let d = 0; d < spec.dayTargets.length; d++) {
      const target = spec.dayTargets[d]
      const k = Math.abs(target) >= 40000 ? 3 : Math.abs(target) >= 18000 ? 2 : 1
      const parts = splitDay(target, k, rnd)
      let minute = 35 // start ~09:35 CT (14:35Z)

      for (const grossNet of parts) {
        const symKey = rnd() < 0.6 ? 'MES' : 'MNQ'
        const { pv, base } = SYMBOLS[symKey]
        const qty = symKey === 'MES' ? 1 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 2)
        const dir = rnd() < 0.5 ? 'LONG' : 'SHORT'
        const gross = grossNet + 124 // add back round-turn fees so net ≈ target part
        const entryPrice = round2(base * (1 + (rnd() - 0.5) * 0.02))
        const points = gross / (pv * qty)
        const exitPrice = round2(dir === 'LONG' ? entryPrice + points : entryPrice - points)

        const hh = 14 + Math.floor(minute / 60)
        const mm = String(minute % 60).padStart(2, '0')
        const entryAt = `${date}T${String(hh).padStart(2, '0')}:${mm}:00.000Z`
        const exMin = minute + 2
        const exitAt = `${date}T${String(14 + Math.floor(exMin / 60)).padStart(2, '0')}:${String(exMin % 60).padStart(2, '0')}:00.000Z`

        const eId = `demo-${spec.seed}-${tIndex}-e`
        const xId = `demo-${spec.seed}-${tIndex}-x`
        const entrySide = dir === 'LONG' ? 0 : 1
        execs.push({
          id: eId, accountRef: account.name, symbol: symKey, contractId: symKey, side: entrySide as 0 | 1,
          size: qty, price: entryPrice, profitAndLoss: null, fees: 62, voided: false, orderId: `o${tIndex}`,
          executedAt: entryAt, source: 'csv'
        })
        execs.push({
          id: xId, accountRef: account.name, symbol: symKey, contractId: symKey, side: (entrySide === 0 ? 1 : 0) as 0 | 1,
          size: qty, price: exitPrice, profitAndLoss: gross, fees: 62, voided: false, orderId: `o${tIndex}`,
          executedAt: exitAt, source: 'csv'
        })

        const win = grossNet > 0
        const stopDist = 12000 / (pv * qty) // ≈ $120 risk
        const plannedStop = round2(dir === 'LONG' ? entryPrice - stopDist : entryPrice + stopDist)
        journalOps.push({
          entryExecId: eId,
          patch: {
            setupTag: SETUPS[Math.floor(rnd() * SETUPS.length)],
            mood: (win ? WIN_MOODS : LOSS_MOODS)[Math.floor(rnd() * 4)],
            disciplineScore: win ? 4 + Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 3),
            ruleAdherence: win ? 4 + Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 3),
            notes: (win ? WIN_NOTES : LOSS_NOTES)[Math.floor(rnd() * 4)],
            plannedStop
          }
        })

        minute += 25
        tIndex++
      }

      days.push({ date, net: target })
      date = nextBusinessDate(date)
    }

    ingestExecutions(db, account.id, execs)

    for (const op of journalOps) {
      updateTradeJournal(db, tradeIdFor(op.entryExecId), op.patch)
    }

    for (const day of days) {
      const green = day.net >= 0
      upsertJournal(db, {
        accountId: account.id,
        tradingDate: day.date,
        bias: green ? 'Constructive above the overnight low; buy dips at VWAP.' : 'Choppy — trade smaller, respect the range.',
        gamePlan:
          'Key levels marked pre-open. Plan: wait for the first 5m range to set, trade the break or the reclaim. ' +
          'Max 3 trades. Stop trading at daily loss limit — no exceptions.',
        moodStart: green ? 'calm and prepared' : 'a little tired',
        review: green
          ? `Solid session, +$${Math.round(day.net / 100)}. Stuck to the plan and the levels worked.`
          : `Red day, -$${Math.abs(Math.round(day.net / 100))}. Overtraded the chop early. Smaller size next time.`,
        whatWorked: green ? 'Patience at the level; scaling out into targets.' : 'Cut losers quickly, no blowup.',
        whatToImprove: green ? 'Could have held the runner longer.' : 'Stop forcing trades in the first 15 minutes.',
        moodEnd: green ? 'satisfied' : 'reset for tomorrow'
      })
    }
  }

  return { accounts: created, loaded: created > 0 }
}
