import { TZDate } from '@date-fns/tz'

const CT = 'America/Chicago'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * The CT trading-session date for a UTC timestamp. Futures sessions roll at
 * 17:00 CT (Globex open), so fills at/after 17:00 CT belong to the next
 * session day. Returns 'YYYY-MM-DD'.
 */
export function ctSessionDate(iso: string): string {
  const d = new TZDate(iso, CT)
  let y = d.getFullYear()
  let m = d.getMonth() // 0-based
  let day = d.getDate()
  if (d.getHours() >= 17) {
    const rolled = new Date(Date.UTC(y, m, day + 1))
    y = rolled.getUTCFullYear()
    m = rolled.getUTCMonth()
    day = rolled.getUTCDate()
  }
  return `${y}-${pad(m + 1)}-${pad(day)}`
}

/** Today's CT session date. */
export function todayCtSessionDate(nowIso: string): string {
  return ctSessionDate(nowIso)
}
