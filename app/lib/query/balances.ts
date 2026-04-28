import {
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'

import type { BalanceCell } from '@/lib/domain'
import { BalanceCellSchema, BalancesResponseSchema } from '@/lib/validation'

import { fetchJson } from './http'
import { balanceKey, balancesKey } from './keys'

export const POLL_INTERVAL_MS = 60_000

/**
 * Pause-on-mutation predicate (TRD §4.6, §4.7). Exported for direct testing
 * because asserting the *behavior* of `refetchInterval` against a 60s timer
 * is impractical — testing the predicate's logic is the cleaner contract.
 *
 * Returns `false` (skip this poll cycle) if any mutation matching the given
 * employee is currently pending. The mutation cache is the source of truth for
 * "is there a write in flight" — checking it on every interval tick keeps the
 * polling timer from clobbering an optimistic update.
 */
export function buildPausePredicate(
  queryClient: QueryClient,
  employeeId: string,
  intervalMs: number = POLL_INTERVAL_MS,
): () => number | false {
  return () => {
    const pending = queryClient
      .getMutationCache()
      .getAll()
      .filter((m) => m.state.status === 'pending')
      .filter((m) => {
        const vars = m.state.variables as { employeeId?: string } | undefined
        return vars?.employeeId === employeeId
      })
    if (pending.length > 0) return false
    return intervalMs
  }
}

/**
 * Read all balance cells for an employee. Polled every 60s, paused while any
 * mutation for the same employee is in flight.
 */
export function useBalances(employeeId: string): UseQueryResult<BalanceCell[]> {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: balancesKey(employeeId),
    queryFn: () => fetchJson(`/api/hcm/balances?employeeId=${employeeId}`, BalancesResponseSchema),
    refetchInterval: buildPausePredicate(queryClient, employeeId),
  })
}

/**
 * Read a single balance cell. With `freshOnly: true`, bypasses the staleness
 * window and forces a refetch on every mount — used by the manager approval
 * surface (TRD §4.4) to guarantee the balance shown is valid at decision time.
 *
 * `enabled` lets a caller mount the hook unconditionally (rules of hooks)
 * while gating the network call on a condition (e.g. an accordion row being
 * expanded).
 */
export function useBalance(
  employeeId: string,
  locationId: string,
  opts?: { freshOnly?: boolean; enabled?: boolean },
): UseQueryResult<BalanceCell> {
  const freshOnly = opts?.freshOnly === true
  const enabled = opts?.enabled !== false
  return useQuery({
    queryKey: balanceKey(employeeId, locationId),
    queryFn: () =>
      fetchJson(
        `/api/hcm/balance?employeeId=${employeeId}&locationId=${locationId}`,
        BalanceCellSchema,
      ),
    staleTime: freshOnly ? 0 : 60_000,
    refetchOnMount: freshOnly ? 'always' : true,
    enabled,
  })
}
