import { randomUUID } from 'crypto'

/** Short, collision-resistant id (no external dep). */
export function newId(prefix = ''): string {
  const uuid = randomUUID().replace(/-/g, '').slice(0, 20)
  return prefix ? `${prefix}_${uuid}` : uuid
}
