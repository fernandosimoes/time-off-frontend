import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { buildPausePredicate, useBalance, useBalances } from '@/lib/query/balances'
import { _resetListenersForTest, subscribe, type Notification } from '@/lib/query/notifications'
import { subscribeBalanceRefreshDetector } from '@/lib/query/refresh-detector'
import { useApproveRequest, useSubmitRequest } from '@/lib/query/requests'
import {
  forceConflict,
  forceLatency,
  forceSilentFailure,
  resetMockState,
  server,
} from '@/tests/setup/msw'

// Each test gets a fresh QueryClient so cache state never leaks across tests.
function makeWrapper(opts?: { staleTime?: number }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: opts?.staleTime ?? 60_000,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return { client, Wrapper }
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  // Default to a tiny latency so tests don't flake against the mock's
  // 200-1500ms jitter range. Individual tests override (e.g. forceLatency
  // 1500ms for the poll-pause test) when they need a slow path.
  forceLatency(20, 20)
})
afterEach(() => {
  server.resetHandlers()
  resetMockState()
  _resetListenersForTest()
})

describe('useBalance / useBalances reads', () => {
  it('useBalances returns the full corpus for an employee', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBalances('emp-1'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
  })

  it('useBalance returns the (employeeId, locationId) cell', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBalance('emp-1', 'loc-1'), {
      wrapper: Wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.daysAvailable).toBe(10)
  })
})

describe('useSubmitRequest — optimistic accept (TRD §5.3 case 1)', () => {
  it('reflects the server-confirmed value after a successful submission', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => ({
        balance: useBalance('emp-1', 'loc-1'),
        submit: useSubmitRequest(),
      }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.balance.isSuccess).toBe(true))
    expect(result.current.balance.data?.daysAvailable).toBe(10)

    result.current.submit.mutate({
      employeeId: 'emp-1',
      locationId: 'loc-1',
      days: 3,
      startDate: '2026-05-01',
      endDate: '2026-05-03',
    })

    await waitFor(() => expect(result.current.submit.isSuccess).toBe(true))
    await waitFor(() => expect(result.current.balance.data?.daysAvailable).toBe(7))
  })
})

describe('useSubmitRequest — 409 rollback (TRD §5.3 case 2)', () => {
  it('rolls back the optimistic decrement when HCM rejects', async () => {
    forceConflict('emp-1', 'loc-1')

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => ({
        balance: useBalance('emp-1', 'loc-1'),
        submit: useSubmitRequest(),
      }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.balance.isSuccess).toBe(true))
    expect(result.current.balance.data?.daysAvailable).toBe(0)

    result.current.submit.mutate({
      employeeId: 'emp-1',
      locationId: 'loc-1',
      days: 1,
      startDate: '2026-05-01',
      endDate: '2026-05-01',
    })

    await waitFor(() => expect(result.current.submit.isError).toBe(true))
    expect(result.current.submit.error?.error).toBe('INSUFFICIENT_BALANCE')
    // After rollback, balance returns to the pre-mutation snapshot value.
    await waitFor(() => expect(result.current.balance.data?.daysAvailable).toBe(0))
  })
})

describe('useSubmitRequest — silent wrongness (TRD §5.3 case 3)', () => {
  it('emits silent-failure-detected when the server claims success without persisting', async () => {
    forceSilentFailure(true)

    const captured: Notification[] = []
    const unsub = subscribe((n) => captured.push(n))

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => ({
        balance: useBalance('emp-1', 'loc-1'),
        submit: useSubmitRequest(),
      }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.balance.isSuccess).toBe(true))

    result.current.submit.mutate({
      employeeId: 'emp-1',
      locationId: 'loc-1',
      days: 4,
      startDate: '2026-05-01',
      endDate: '2026-05-04',
    })

    await waitFor(() => expect(result.current.submit.isSuccess).toBe(true))

    // Silent-wrongness check fires after a 300ms delay then refetches.
    await waitFor(
      () => {
        expect(captured.some((n) => n.kind === 'silent-failure-detected')).toBe(true)
      },
      { timeout: 3_000 },
    )

    unsub()
  })
})

describe('Anniversary mid-flight (TRD §5.3 case 4)', () => {
  it('does not disrupt an in-flight optimistic submission', async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => ({
        balance: useBalance('emp-1', 'loc-1'),
        submit: useSubmitRequest(),
      }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.balance.isSuccess).toBe(true))
    expect(result.current.balance.data?.daysAvailable).toBe(10)

    forceLatency(400, 400)

    result.current.submit.mutate({
      employeeId: 'emp-1',
      locationId: 'loc-1',
      days: 3,
      startDate: '2026-05-01',
      endDate: '2026-05-03',
    })

    // Mid-flight: trigger anniversary on the same (emp, loc).
    // The server-side handler is hit directly via fetch; balance becomes 11 (seed=10 + 1).
    // When the in-flight submission resolves on the server, server decrements 11 → 8.
    await fetch('/api/hcm/dev/trigger-anniversary', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ employeeId: 'emp-1' }),
    })

    await waitFor(() => expect(result.current.submit.isSuccess).toBe(true))
    // After settle + invalidate, the cell reflects (11 - 3 = 8) — anniversary
    // didn't disrupt the flow.
    await waitFor(() => expect(result.current.balance.data?.daysAvailable).toBe(8))
  })
})

describe('Manager forced fresh read (TRD §5.3 case 5)', () => {
  it('useBalance({ freshOnly: true }) refetches even when a stale cache exists', async () => {
    const { Wrapper, client } = makeWrapper()
    // Pre-warm the cache by mounting the hook once.
    const first = renderHook(() => useBalance('emp-1', 'loc-1'), { wrapper: Wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    expect(first.result.current.data?.daysAvailable).toBe(10)
    first.unmount()

    // Server-side change — cache is now stale.
    await fetch('/api/hcm/dev/trigger-anniversary', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ employeeId: 'emp-1' }),
    })

    // Mount again with freshOnly. Should refetch on mount and show 11.
    const second = renderHook(
      () => useBalance('emp-1', 'loc-1', { freshOnly: true }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(second.result.current.data?.daysAvailable).toBe(11))

    // Sanity: confirm the underlying cache reflects the fresh value too.
    const cached = client.getQueryData<{ daysAvailable: number }>(['balances', 'emp-1', 'loc-1'])
    expect(cached?.daysAvailable).toBe(11)
  })
})

describe('Poll pauses while mutation is pending (TRD §5.3 case 6 + spec acceptance)', () => {
  it('predicate returns false during a slow mutation, then resumes after settlement', async () => {
    forceLatency(1500, 1500)

    const { client, Wrapper } = makeWrapper()
    const { result } = renderHook(() => useSubmitRequest(), { wrapper: Wrapper })

    const predicate = buildPausePredicate(client, 'emp-1')

    // Baseline: no in-flight mutation, predicate returns the configured interval.
    expect(predicate()).toBe(60_000)

    result.current.mutate({
      employeeId: 'emp-1',
      locationId: 'loc-1',
      days: 2,
      startDate: '2026-05-01',
      endDate: '2026-05-02',
    })

    // While the mutation is pending the predicate must report `false` so the
    // poll skips its tick (TRD §4.6 #1).
    await waitFor(() =>
      expect(
        client
          .getMutationCache()
          .getAll()
          .some((m) => m.state.status === 'pending'),
      ).toBe(true),
    )
    expect(predicate()).toBe(false)

    // After settlement the predicate returns to the polling interval (TRD §4.6 #2).
    await waitFor(() => expect(result.current.isSuccess).toBe(true), {
      timeout: 5_000,
    })
    expect(predicate()).toBe(60_000)
  }, 10_000)
})

describe('Per-location scoping (TRD §5.3 case 7)', () => {
  it('mutating (emp-1, loc-1) does not invalidate (emp-1, loc-2)', async () => {
    const { Wrapper, client } = makeWrapper()
    const { result } = renderHook(
      () => ({
        loc1: useBalance('emp-1', 'loc-1'),
        loc2: useBalance('emp-1', 'loc-2'),
        submit: useSubmitRequest(),
      }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.loc1.isSuccess).toBe(true))
    await waitFor(() => expect(result.current.loc2.isSuccess).toBe(true))

    // Snapshot the dataUpdatedAt of loc-2 before the mutation.
    const loc2QueryBefore = client.getQueryState(['balances', 'emp-1', 'loc-2'])
    const loc2UpdatedBefore = loc2QueryBefore?.dataUpdatedAt

    result.current.submit.mutate({
      employeeId: 'emp-1',
      locationId: 'loc-1',
      days: 2,
      startDate: '2026-05-01',
      endDate: '2026-05-02',
    })

    await waitFor(() => expect(result.current.submit.isSuccess).toBe(true))

    // loc-2's cache entry should not have been re-fetched. The dataUpdatedAt
    // is the cleanest signal: it only updates when the query refetches.
    const loc2QueryAfter = client.getQueryState(['balances', 'emp-1', 'loc-2'])
    expect(loc2QueryAfter?.dataUpdatedAt).toBe(loc2UpdatedBefore)
  })
})

describe('balance-refreshed detection', () => {
  it('emits balance-refreshed when a polled value strictly increases', async () => {
    const captured: Notification[] = []
    const unsub = subscribe((n) => captured.push(n))

    const { client, Wrapper } = makeWrapper()
    const unsubDetector = subscribeBalanceRefreshDetector(client)

    const { result } = renderHook(() => useBalance('emp-1', 'loc-1'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.data?.daysAvailable).toBe(10))

    // Server-side increase (anniversary).
    await fetch('/api/hcm/dev/trigger-anniversary', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ employeeId: 'emp-1' }),
    })

    // Force a refetch — would normally happen via the 60s poll.
    await result.current.refetch()
    await waitFor(() => expect(result.current.data?.daysAvailable).toBe(11))

    expect(
      captured.some(
        (n) =>
          n.kind === 'balance-refreshed' &&
          n.employeeId === 'emp-1' &&
          n.locationId === 'loc-1' &&
          n.delta === 1,
      ),
    ).toBe(true)

    unsub()
    unsubDetector()
  })

  it('does not emit on user-driven decrements (mutation invalidate-then-refetch)', async () => {
    const captured: Notification[] = []
    const unsub = subscribe((n) => captured.push(n))

    const { client, Wrapper } = makeWrapper()
    const unsubDetector = subscribeBalanceRefreshDetector(client)

    const { result } = renderHook(
      () => ({
        balance: useBalance('emp-1', 'loc-1'),
        submit: useSubmitRequest(),
      }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(result.current.balance.isSuccess).toBe(true))

    result.current.submit.mutate({
      employeeId: 'emp-1',
      locationId: 'loc-1',
      days: 3,
      startDate: '2026-05-01',
      endDate: '2026-05-03',
    })
    await waitFor(() => expect(result.current.submit.isSuccess).toBe(true))
    await waitFor(() => expect(result.current.balance.data?.daysAvailable).toBe(7))

    expect(captured.filter((n) => n.kind === 'balance-refreshed')).toHaveLength(0)

    unsub()
    unsubDetector()
  })
})

describe('useApproveRequest — pessimistic', () => {
  it('approves without an optimistic balance change', async () => {
    // Submit a request first, get its id.
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => ({
        submit: useSubmitRequest(),
        approve: useApproveRequest(),
      }),
      { wrapper: Wrapper },
    )

    result.current.submit.mutate({
      employeeId: 'emp-1',
      locationId: 'loc-1',
      days: 2,
      startDate: '2026-05-01',
      endDate: '2026-05-02',
    })
    await waitFor(() => expect(result.current.submit.isSuccess).toBe(true))
    const submitted = result.current.submit.data
    expect(submitted).toBeDefined()

    result.current.approve.mutate({
      requestId: submitted!.id,
      decision: 'approve',
      managerId: 'mgr-1',
    })
    await waitFor(() => expect(result.current.approve.isSuccess).toBe(true))
    expect(result.current.approve.data?.status).toBe('approved')
  })
})
