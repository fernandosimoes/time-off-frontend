import type { QueryClient } from '@tanstack/react-query'

import type { BalanceCell } from '@/lib/domain'

import { emit } from './notifications'

// Tracks the previous data of each balance query so we can detect refreshes.
// Indexed by stringified queryKey because the QueryCache subscribe API doesn't
// hand us the previous data — it only tells us a query was updated.
type Tracker = Map<string, BalanceCell | BalanceCell[]>

function isCellKey(key: readonly unknown[]): key is readonly ['balances', string, string] {
  return key[0] === 'balances' && key.length === 3
}

function isCorpusKey(key: readonly unknown[]): key is readonly ['balances', string] {
  return key[0] === 'balances' && key.length === 2
}

function emitIfRefreshed(
  prev: BalanceCell,
  next: BalanceCell,
  employeeId: string,
  locationId: string,
): void {
  // External refresh heuristic (TRD §3, §6 "Balance-refreshed-mid-session"):
  // anniversary bonuses and HR adjustments produce strict INCREASES in
  // daysAvailable. User-driven decrements come from mutations and arrive via
  // the optimistic path, not via fetched-data refreshes. Limiting to delta>0
  // avoids false positives on every mutation invalidate-then-refetch cycle.
  const delta = next.daysAvailable - prev.daysAvailable
  if (delta > 0) {
    emit({ kind: 'balance-refreshed', employeeId, locationId, delta })
  }
}

/**
 * Wire the QueryCache to emit `balance-refreshed` notifications whenever a
 * polled balance value strictly increases. Returns an unsubscribe function.
 */
export function subscribeBalanceRefreshDetector(client: QueryClient): () => void {
  const tracker: Tracker = new Map()

  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated') return
    if (event.action.type !== 'success') return

    const key = event.query.queryKey
    if (!Array.isArray(key) || key[0] !== 'balances') return

    const data = event.query.state.data
    if (data === undefined) return

    const trackerKey = JSON.stringify(key)
    const previous = tracker.get(trackerKey)

    if (isCellKey(key)) {
      const nextCell = data as BalanceCell
      tracker.set(trackerKey, { ...nextCell })
      if (previous) {
        emitIfRefreshed(previous as BalanceCell, nextCell, key[1], key[2])
      }
      return
    }

    if (isCorpusKey(key)) {
      const nextCorpus = data as BalanceCell[]
      tracker.set(
        trackerKey,
        nextCorpus.map((c) => ({ ...c })),
      )
      if (previous) {
        const prevCorpus = previous as BalanceCell[]
        for (const nextCell of nextCorpus) {
          const prevCell = prevCorpus.find((c) => c.locationId === nextCell.locationId)
          if (prevCell) emitIfRefreshed(prevCell, nextCell, key[1], nextCell.locationId)
        }
      }
    }
  })

  return unsubscribe
}
