# Milestone 3: Data Layer (TanStack Query)

**Estimated effort:** 6 hours
**Depends on:** Milestones 1, 2
**Unblocks:** Milestones 4, 5

## Goal

Build the data fetching and mutation layer using TanStack Query. By the end of this milestone, the rest of the app can call hooks like `useBalance()` and `useSubmitRequest()` and get all the optimistic update, rollback, reconciliation, and polling behavior described in the TRD.

This is the most architecturally sensitive milestone. **Read TRD §4.3, §4.4, §4.5, §4.6, §4.7 before starting.**

## Scope

### In scope

1. **Install TanStack Query v5 and devtools**
2. **QueryClient configuration** in `lib/query/client.ts`:
   - Default `staleTime: 60_000`
   - `refetchOnWindowFocus: true`
   - `refetchIntervalInBackground: false`
   - Retry with exponential backoff on errors (`retry: 3`, `retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30_000)`)
3. **Provider component** in `app/providers.tsx`, wrapped around children in `app/layout.tsx`
4. **Query hooks** in `lib/query/balances.ts`:
   - `useBalances(employeeId)`: batch corpus, polled every 60s with the pause-on-mutation predicate
   - `useBalance(employeeId, locationId, opts?: { freshOnly?: boolean })`: single-cell read; when `freshOnly: true`, sets `staleTime: 0` and refetches on mount (used by manager approval per TRD §4.4)
5. **Mutation hooks** in `lib/query/requests.ts`:
   - `useSubmitRequest()`: optimistic, with rollback per TRD §4.4
   - `useApproveRequest()`: pessimistic (no optimistic update), invalidates the affected balance on success
6. **Reconciliation logic** that implements TRD §4.6:
   - The polling predicate that pauses when mutations are in flight for a (employeeId, locationId) tuple
   - The "silent wrongness" detection: after a mutation settles successfully, if the next batch poll returns a value that contradicts the mutation, emit a non-blocking notification (see notes on toast wiring below)
7. **Test infrastructure with MSW** in `tests/setup/msw.ts`:
   - Reuse the route handler logic from Milestone 1 by importing the mock state module (route handlers and MSW handlers can share the underlying mock state)
   - Helpers to force specific scenarios in tests: `forceSilentFailure()`, `forceLatency(ms)`, `forceConflict()`
8. **Integration tests** in `tests/integration/data-layer.test.ts` covering each Critical Test Case from TRD §5.3

### Out of scope

- UI components (Milestones 4-5)
- Toast UI (the notification emitter exists, but it's just a callback or event the UI will subscribe to in Milestone 4)
- Storybook stories

## Specifications

### Hook signatures

```ts
// lib/query/balances.ts
export function useBalances(employeeId: string): UseQueryResult<BalanceCell[]>
export function useBalance(
  employeeId: string,
  locationId: string,
  opts?: { freshOnly?: boolean }
): UseQueryResult<BalanceCell>

// lib/query/requests.ts
export function useSubmitRequest(): UseMutationResult<TimeOffRequest, HcmError, SubmitRequest>
export function useApproveRequest(): UseMutationResult<TimeOffRequest, HcmError, ApproveRequest>
```

### Optimistic update contract for `useSubmitRequest`

Use the `onMutate` / `onError` / `onSettled` lifecycle:

1. `onMutate`: cancel in-flight queries for the affected balance, snapshot current cache, optimistically decrement the balance for (employeeId, locationId), return the snapshot as context
2. `onError`: roll back to the snapshot, surface the error
3. `onSettled`: invalidate the (employeeId, locationId) balance to force a final reconciliation

### Pause-on-mutation predicate

The batch poll's `refetchInterval` accepts a function. Use the `useQueryClient().getMutationCache().getAll()` to check if any mutation matching the affected employee is currently `pending`. If so, return `false` (skip this poll cycle). Otherwise return `60_000`.

### Silent wrongness detection

After a `useSubmitRequest` settles successfully, schedule a single forced re-fetch of the affected balance (300ms delay to let the mock have the next state ready). If the result contradicts the mutation outcome (e.g., balance unchanged when it should have decremented), emit a notification.

For now, the notification is a callback registered via a simple module-scoped subscription:

```ts
// lib/query/notifications.ts
type Notification = { kind: 'silent-failure-detected' | 'background-refresh' | ...; ... }
let listeners: Array<(n: Notification) => void> = []
export function subscribe(fn): () => void
export function emit(n: Notification): void
```

Milestone 4 wires this to a toast component.

### Notification kinds (initial set)

- `silent-failure-detected`: the data we just wrote was not persisted upstream
- `background-refresh-conflict`: a polled value contradicts a recent mutation
- `balance-refreshed`: anniversary bonus or external change detected mid-session

## Acceptance Criteria

- [ ] All hooks documented with TSDoc on signatures
- [ ] All Critical Test Cases from TRD §5.3 have a matching test that passes
- [ ] Tests are deterministic (no flakiness from the 5% silent failure dice; force the header)
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:run` all pass
- [ ] No console errors from React or TanStack Query in any test
- [ ] The poll-pause behavior is verified: write a test that starts a slow mutation (forced 1500ms latency) and asserts that the polling timer does NOT fire during that window

## Completion Report Template

Same as before. Add: a description of how the silent-wrongness detection was implemented, with the specific timing values used. The human will sanity-check this is reasonable.

## Notes for the Agent

- TanStack Query v5 has significant API differences from v4. If a search result mentions `useQuery({ onSuccess: ... })`, that's v4. v5 removed those callbacks; you handle side effects differently
- The MSW + route-handler-state sharing pattern requires the mock state module to be importable from both contexts. If Next.js's bundling makes this awkward, the simpler path is: tests reset state via `POST /api/hcm/__dev/reset` before each test, hitting the running dev server. Decide and document the choice
- Avoid over-abstracting. If a hook is 30 lines, that's fine. Don't extract premature `createOptimisticMutationFactory` helpers