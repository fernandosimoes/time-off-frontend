# Milestone 1: Bootstrap + Mock HCM

**Estimated effort:** 4 hours
**Depends on:** none (this is the first milestone)
**Unblocks:** Milestone 2 (Domain + Validation)

## Goal

Stand up the Next.js project skeleton, configure the toolchain, and implement the mock HCM as Next.js route handlers with realistic simulated behaviors. By the end of this milestone, the mock HCM is fully functional and tested in isolation, before any UI exists.

This milestone is intentionally bottom-up: the mock is the foundation everything else builds on.

## Scope

### In scope

1. **Next.js 14+ App Router project** with TypeScript strict mode
2. **Toolchain configured:**
   - Tailwind CSS
   - shadcn/ui initialized (no components added yet, just the base config)
   - Vitest + React Testing Library
   - Storybook 8 (basic config, no stories yet)
   - MSW (installed, not configured yet)
   - ESLint + Prettier
3. **Mock HCM state and route handlers** under `app/api/hcm/*`:
   - Module-scoped state in `lib/hcm/state.ts` with hardcoded employees/locations/balances
   - All endpoints listed in §4.8 of the TRD
   - All simulated behaviors listed in §4.8 of the TRD
4. **Tests for the mock HCM** that hit the route handlers directly (no UI)
5. **`pnpm` scripts** matching the commands in CLAUDE.md
6. **A minimal `app/layout.tsx`** with the role switcher placeholder (just two `<Link>` elements to `/employee` and `/manager`, no styling)
7. **Placeholder pages** at `app/employee/page.tsx` and `app/manager/page.tsx` that just render the route name. Real implementation comes in later milestones

### Out of scope

- Real UI components beyond placeholders
- TanStack Query setup (Milestone 3)
- Zod schemas (Milestone 2)
- Storybook stories (Milestones 4-5)
- Integration tests with MSW (Milestone 3 onwards)

## Mock HCM Specification

### Hardcoded state

```ts
// lib/hcm/state.ts (initial seed, exported for resets)

export type Employee = {
  id: string
  name: string
  hireDate: Date          // for anniversary bonus calculation
}

export type Location = {
  id: string
  name: string
}

export type BalanceCell = {
  employeeId: string
  locationId: string
  daysAvailable: number
  lastUpdated: Date
}

// Seed:
// 3 employees: emp-1 (Ana, hired 2023-04-30), emp-2 (Bruno, hired 2024-12-01), emp-3 (Carla, hired 2022-04-29)
// 2 locations: loc-1 (Headquarters), loc-2 (Remote)
// 6 balance cells with varied daysAvailable: 10, 5, 15, 3, 0, 20
```

### Endpoints

All endpoints return JSON. All write endpoints validate the request body shape (basic, since Zod comes in Milestone 2; for now use manual checks).

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/api/hcm/balance?employeeId=X&locationId=Y` | Returns single `BalanceCell`. 404 if not found. Authoritative read. |
| `GET` | `/api/hcm/balances?employeeId=X` | Returns all `BalanceCell` for an employee (batch corpus). |
| `POST` | `/api/hcm/request` | Accepts `{ employeeId, locationId, days, startDate, endDate }`. Decrements balance if sufficient. Returns request record. |
| `POST` | `/api/hcm/approve` | Accepts `{ requestId, decision: 'approve' \| 'deny', managerId }`. Updates request status. Note: the balance decrement happens on submit (POST /request), not on approve, in this simulation. |
| `POST` | `/api/hcm/__dev/trigger-anniversary` | Accepts `{ employeeId }`. Adds 1 day to all balances for that employee. Used by tests for determinism. |
| `POST` | `/api/hcm/__dev/reset` | Resets module state to the seed values. |

### Simulated behaviors

These are the behaviors the UI is expected to handle gracefully. Implement them as described:

1. **Latency simulation:** before responding, every endpoint awaits a random delay.
   - Reads: 100-800ms
   - Writes: 200-1500ms
   - Helper: `await jitter(min, max)` in `lib/hcm/state.ts`

2. **Anniversary bonus timer:** a `setInterval` running every 90 seconds picks a random employee and adds 1 day to all their balances.
   - The timer starts when the module is first imported (server lifecycle)
   - It does not fire during tests (gate it with `if (process.env.NODE_ENV !== 'test')`)

3. **Silent failure injection on writes:** 5% of write requests return `200 OK` with the request payload echoed back, but **do not** mutate state.
   - Forceable via header `x-mock-force-failure: silent`
   - Implement as a helper `shouldFailSilently(req): boolean` that checks the header first, then rolls the 5% dice

4. **Insufficient balance returns 409:**
   - Body: `{ error: 'INSUFFICIENT_BALANCE', requested: number, available: number }`

5. **Unknown employee/location returns 404:**
   - Body: `{ error: 'NOT_FOUND' }`

### Request record shape

```ts
type TimeOffRequest = {
  id: string                    // crypto.randomUUID()
  employeeId: string
  locationId: string
  days: number
  startDate: string             // ISO date
  endDate: string               // ISO date
  status: 'pending' | 'approved' | 'denied'
  createdAt: string             // ISO timestamp
  decidedAt?: string            // ISO timestamp, set on approve/deny
  decidedBy?: string            // managerId
}
```

Store requests in module-scoped state, keyed by id.

## Acceptance Criteria

### Project bootstrap

- [ ] `pnpm install` succeeds
- [ ] `pnpm dev` starts the Next.js server without errors
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm test:run` passes (even if zero tests, the command must work)
- [ ] `pnpm storybook` starts successfully on port 6006
- [ ] `pnpm lint` passes
- [ ] `tsconfig.json` has `"strict": true` and `"noUncheckedIndexedAccess": true`
- [ ] `@/` path alias is configured

### Mock HCM functional

- [ ] All endpoints respond with the documented shape
- [ ] Visiting `GET /api/hcm/balances?employeeId=emp-1` returns 2 balance cells
- [ ] Submitting a request via `POST /api/hcm/request` for more days than available returns 409 with the documented error body
- [ ] Submitting a request for valid days decrements the balance
- [ ] `POST /api/hcm/__dev/trigger-anniversary` adds 1 day per balance for the given employee
- [ ] `POST /api/hcm/__dev/reset` returns the state to the seed
- [ ] Latency jitter is observable (manual smoke test is fine)

### Tests

Write Vitest tests in `tests/integration/hcm.test.ts` that hit the route handlers directly (use Next.js `Request`/`Response` or `fetch` against a running test server, your choice).

- [ ] Test: GET `/api/hcm/balance` returns the expected cell for known (employeeId, locationId)
- [ ] Test: GET `/api/hcm/balance` returns 404 for unknown locationId
- [ ] Test: POST `/api/hcm/request` decrements balance on success
- [ ] Test: POST `/api/hcm/request` returns 409 with structured body when insufficient balance
- [ ] Test: POST `/api/hcm/request` with header `x-mock-force-failure: silent` returns 200 but does NOT mutate state (verify via subsequent GET)
- [ ] Test: POST `/api/hcm/__dev/trigger-anniversary` increments balances
- [ ] Test: POST `/api/hcm/__dev/reset` resets state between tests (use this in a `beforeEach`)

All tests deterministic. The 5% silent failure dice MUST NOT cause test flakiness. Either always force the header in tests, or stub the random source.

### Documentation

- [ ] `README.md` skeleton at the repo root with: project description (1 paragraph), how to run (`pnpm install && pnpm dev`), how to test (`pnpm test:run`), where to find the TRD
- [ ] No placeholder text like `TODO` or `lorem ipsum` in any committed file

## Completion Report Template

When this milestone is done, fill out this template and return it as the response:

```
Milestone 1 complete.

Done:
- [list of what was implemented, by area]

Tests passing:
- [count] of [count] tests pass
- pnpm typecheck: clean
- pnpm lint: clean

Deferred / out of scope (with rationale):
- [items, if any]

Decisions made without explicit guidance (with rationale):
- [items, if any]

Files changed:
- [tree of created/modified files]

Ready to proceed to Milestone 2 (Domain + Validation).
```

## Notes for the Agent

- This milestone is bottom-up infrastructure. Resist the urge to start building UI components. The next milestones depend on a solid mock and a clean toolchain
- The latency jitter and silent failure features are tested in later milestones via integration tests against the data layer. For now, just make sure they're implemented and behave correctly in isolation
- If shadcn/ui setup requires installing a primitive to verify it works, install only `Button` and remove it after the smoke test. We add components on demand in later milestones
- Do NOT install TanStack Query, Zod, or react-hook-form yet. Those come with Milestones 2 and 3 to keep dependencies traceable to the milestone that justifies them