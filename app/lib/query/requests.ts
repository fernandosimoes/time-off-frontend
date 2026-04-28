import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'

import type { BalanceCell } from '@/lib/domain'
import type { ApproveRequest, HcmError, SubmitRequest, TimeOffRequest } from '@/lib/validation'
import {
  BalanceCellSchema,
  TimeOffRequestListSchema,
  TimeOffRequestSchema,
} from '@/lib/validation'

import { fetchJson, HcmRequestError } from './http'
import { balanceKey, balancesKey, requestsKey } from './keys'
import { emit } from './notifications'

// Adapt thrown HcmRequestError into the plain HcmError shape so the mutation
// surface conforms to the signature in spec §03 ("UseMutationResult<…, HcmError, …>").
function toHcmError(e: unknown): HcmError {
  if (e instanceof HcmRequestError) return e.hcm
  if (e instanceof Error) return { error: 'BAD_REQUEST', message: e.message }
  return { error: 'BAD_REQUEST', message: 'unknown error' }
}

async function submit(input: SubmitRequest): Promise<TimeOffRequest> {
  try {
    return await fetchJson('/api/hcm/request', TimeOffRequestSchema, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch (e) {
    throw toHcmError(e)
  }
}

async function approve(input: ApproveRequest): Promise<TimeOffRequest> {
  try {
    return await fetchJson('/api/hcm/approve', TimeOffRequestSchema, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch (e) {
    throw toHcmError(e)
  }
}

type SubmitContext = {
  balanceSnap: BalanceCell | undefined
  balancesSnap: BalanceCell[] | undefined
  preBalance: number | undefined
}

const SILENT_WRONGNESS_DELAY_MS = 300

/**
 * Submit a time-off request optimistically (TRD §4.4).
 *
 * Lifecycle:
 * - onMutate: cancel in-flight reads, snapshot, optimistically decrement
 * - onError: roll back to snapshot
 * - onSuccess: schedule a forced re-fetch 300ms later; if the server's value
 *   contradicts the optimistic decrement (i.e. the balance is unchanged),
 *   emit `silent-failure-detected`. This implements TRD §4.6 #3.
 * - onSettled: invalidate the affected (employeeId, locationId) cell so the
 *   final reconciliation comes from the server, not the optimistic guess.
 */
export function useSubmitRequest(): UseMutationResult<
  TimeOffRequest,
  HcmError,
  SubmitRequest,
  SubmitContext
> {
  const queryClient = useQueryClient()

  return useMutation<TimeOffRequest, HcmError, SubmitRequest, SubmitContext>({
    mutationFn: submit,

    onMutate: async (input) => {
      const cellKey = balanceKey(input.employeeId, input.locationId)
      const corpusKey = balancesKey(input.employeeId)

      await queryClient.cancelQueries({ queryKey: cellKey })
      await queryClient.cancelQueries({ queryKey: corpusKey })

      const balanceSnap = queryClient.getQueryData<BalanceCell>(cellKey)
      const balancesSnap = queryClient.getQueryData<BalanceCell[]>(corpusKey)

      if (balanceSnap) {
        queryClient.setQueryData<BalanceCell>(cellKey, {
          ...balanceSnap,
          daysAvailable: balanceSnap.daysAvailable - input.days,
        })
      }
      if (balancesSnap) {
        queryClient.setQueryData<BalanceCell[]>(
          corpusKey,
          balancesSnap.map((cell) =>
            cell.locationId === input.locationId
              ? { ...cell, daysAvailable: cell.daysAvailable - input.days }
              : cell,
          ),
        )
      }

      // The single-cell snapshot is the most direct source of pre-mutation
      // balance, but the page may only have populated the corpus query
      // (`useBalances`). Fall back to that so silent-wrongness detection
      // works even when the single-cell query isn't mounted.
      const preBalance =
        balanceSnap?.daysAvailable ??
        balancesSnap?.find((c) => c.locationId === input.locationId)?.daysAvailable

      return {
        balanceSnap,
        balancesSnap,
        preBalance,
      }
    },

    // 4xx/5xx responses surface to the form via `mutation.error`; we do NOT
    // emit a notification here. Per TRD §4.6 #3, the
    // `background-refresh-conflict` kind is reserved for the case where a
    // polled value contradicts a recently-acknowledged mutation — a different
    // surface than a synchronous 409 from the user's own submission.
    onError: (_error, input, context) => {
      const cellKey = balanceKey(input.employeeId, input.locationId)
      const corpusKey = balancesKey(input.employeeId)
      if (context?.balanceSnap !== undefined) {
        queryClient.setQueryData(cellKey, context.balanceSnap)
      }
      if (context?.balancesSnap !== undefined) {
        queryClient.setQueryData(corpusKey, context.balancesSnap)
      }
    },

    onSuccess: (data, input, context) => {
      // Append the server-acknowledged record to the local request history
      // cache (M4 view). No server endpoint for "list my requests" exists yet
      // — this is a client-side derivation; freshness lives only as long as
      // the QueryClient does (page reload clears).
      queryClient.setQueryData<TimeOffRequest[]>(requestsKey(input.employeeId), (prev = []) => [
        data,
        ...prev,
      ])

      // Silent-wrongness detection: schedule a forced re-fetch after a short
      // delay so the mock has time to settle. If the server-side balance
      // shows no decrement, the 200 OK was a lie.
      const pre = context?.preBalance
      if (pre === undefined) return

      const cellKey = balanceKey(input.employeeId, input.locationId)
      window.setTimeout(() => {
        queryClient
          .fetchQuery({
            queryKey: cellKey,
            queryFn: () =>
              fetchJson(
                `/api/hcm/balance?employeeId=${input.employeeId}&locationId=${input.locationId}`,
                BalanceCellSchema,
              ),
            staleTime: 0,
          })
          .then((fresh) => {
            // The unchanged-balance check is intentionally narrow: equal-to-
            // pre means nothing was applied. Any other value (including
            // anniversary bonus shifting it up by 1) is treated as noise to
            // avoid false positives. The next regular poll will reconcile.
            if (fresh.daysAvailable === pre) {
              emit({
                kind: 'silent-failure-detected',
                employeeId: input.employeeId,
                locationId: input.locationId,
                attemptedDays: input.days,
              })
            }
          })
          .catch(() => {
            // The next 60s poll will try again; a single failed reconciliation
            // is not worth surfacing.
          })
      }, SILENT_WRONGNESS_DELAY_MS)
    },

    // Invalidate only the specific (employeeId, locationId) cell — TRD §4.5.
    // Per-location scoping means a mutation on loc-A never triggers a refetch
    // of loc-B. The corpus query keeps its optimistic value; the next regular
    // 60s poll reconciles it with the server.
    onSettled: (_data, _error, input) => {
      void queryClient.invalidateQueries({
        queryKey: balanceKey(input.employeeId, input.locationId),
      })
    },
  })
}

/**
 * Approve or deny a request (TRD §4.4).
 *
 * Pessimistic — no optimistic mutation. The manager surface separately forces
 * a fresh balance read (via `useBalance(..., { freshOnly: true })`) before the
 * approval form opens, eliminating the entire "approved with stale balance"
 * category in exchange for a 200ms spinner.
 *
 * On success, invalidates the affected balance — even though the M1 mock
 * doesn't decrement on approve, the cache might still be stale from a prior
 * action and the cost of a refetch is trivial.
 */
export function useApproveRequest(): UseMutationResult<
  TimeOffRequest,
  HcmError,
  ApproveRequest
> {
  const queryClient = useQueryClient()
  return useMutation<TimeOffRequest, HcmError, ApproveRequest>({
    mutationFn: approve,
    onSuccess: (data) => {
      // Refresh the affected balance.
      void queryClient.invalidateQueries({
        queryKey: balanceKey(data.employeeId, data.locationId),
      })
      // Patch the employee's history cache so the same-session employee tab
      // sees the new status immediately. The next 60s poll would catch this
      // anyway, but instant feedback is cheap and worth it.
      queryClient.setQueryData<TimeOffRequest[]>(requestsKey(data.employeeId), (prev) =>
        prev ? prev.map((r) => (r.id === data.id ? data : r)) : prev,
      )
      // Drop this request from the manager's pending list.
      void queryClient.invalidateQueries({ queryKey: ['requests', 'pending'] })
    },
  })
}

/**
 * Server-backed view of the employee's request history. Polls every 60s on
 * the same cadence as the balance corpus so a manager-side approval/denial
 * propagates to the employee surface within one poll window even across
 * separate tabs.
 *
 * `useSubmitRequest` also writes optimistically into this cache on success
 * so the user sees their freshly-submitted request without waiting for the
 * next poll.
 */
export function useRequestHistory(employeeId: string): UseQueryResult<TimeOffRequest[]> {
  return useQuery<TimeOffRequest[]>({
    queryKey: requestsKey(employeeId),
    queryFn: async () => {
      const list = await fetchJson(
        `/api/hcm/requests?employeeId=${encodeURIComponent(employeeId)}`,
        TimeOffRequestListSchema,
      )
      // Most recent first.
      return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

/**
 * Manager view: lists all pending time-off requests across employees. Polled
 * on the same 60s cadence as the balance corpus so newly-submitted requests
 * surface without a manual refresh.
 */
export function usePendingRequests(): UseQueryResult<TimeOffRequest[]> {
  return useQuery<TimeOffRequest[]>({
    queryKey: ['requests', 'pending'] as const,
    queryFn: () => fetchJson('/api/hcm/requests?status=pending', TimeOffRequestListSchema),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}
