# TRD: Time-Off Frontend for ExampleHR

**Author:** Fernando Simoes
**Date:** April 27, 2026
**Status:** Draft

## 1. Context & Problem

ExampleHR is the employee-facing layer for time-off requests, but the source of truth lives in an external HCM system (Workday, SAP, etc). The frontend must present balances and request workflows that feel instant and trustworthy, while honestly reflecting that ExampleHR does not own the underlying numbers.

The central tension is between two competing user expectations:
- **Speed:** the UI must respond instantly to actions (balance display, request submission), without waiting for HCM round-trips.
- **Correctness:** the UI must never lie. A user who sees "approved" cannot later be told "actually, denied." A balance shown at decision time must be valid at decision time.

Tensions like this one, between speed and correctness when the source of truth lives elsewhere, are familiar territory for me. In past work, I've found that two practices help most: clear domain boundaries that isolate the parts of the system you don't control, and an agentic workflow that keeps the humans focused on specification and verification rather than line-by-line implementation. Both shape the approach in this document.

This document specifies the architecture, technical decisions, and test strategy for resolving that tension.

## 2. Scope

**In scope:**
- Employee view: read balances per-location, submit time-off requests, see request lifecycle
- Manager view: approve/deny pending requests with balance context fresh at decision time
- Mock HCM endpoints simulating real-time read/write, batch hydration, anniversary bonuses, silent failures, conflict responses
- Storybook stories covering all meaningful UI states
- Test strategy with deliberate coverage choices
- Shared validation schemas (Zod) across client and server boundaries

**Out of scope (explicitly):**
- Authentication and authorization (assumed handled upstream)
- Persistence beyond in-memory mock state
- Real-time push channels (WebSockets, SSE), see §7 for rationale
- Mobile-specific layouts beyond responsive defaults
- Internationalization
- E2E tests with Playwright/Cypress (rationale in §5)

## 3. Key Challenges

The briefing surfaces the central concerns. I add my own observations where relevant.

1. **Stale balances.** HCM can mutate a balance underneath an open session (anniversary bonus, year reset, manual HR adjustment). The UI must reconcile without surprising the user.
2. **Optimistic UX vs source-of-truth correctness.** Submitting a request must feel instant, but HCM may reject after the optimistic update has rendered.
3. **Silent wrongness.** HCM can return a `200 OK` response that is incorrect (e.g. accepting an over-balance request). The UI must be defensive even on success responses.
4. **Per-location dimensionality.** A single employee has multiple balance rows (one per location). UI must scope reads/writes correctly to the (employeeId, locationId) tuple.
5. **Race between background refresh and in-flight action.** A periodic reconciliation poll can land mid-request. The system must merge them without dropping the user's pending action.
6. **Manager decision context.** The balance shown to the manager must be valid at the moment of approval, not when the request was submitted (could be hours stale).


## 4. Proposed Solution

### 4.1 Architecture Overview

Three layers:
- **Presentation:** React components (Employee/Manager views), Storybook-driven
- **Domain:** types, Zod validators, request lifecycle as discriminated unions
- **Data:** TanStack Query hooks + mock HCM client + route handlers

### 4.2 Component Tree

Two route-based views, with a demo-only role switcher in the header for evaluation convenience.

```
app/
├── layout.tsx                  // <RoleSwitcher /> in header (demo helper only)
├── employee/page.tsx
│   └── <EmployeeView>
│       ├── <BalanceList>
│       │   └── <BalanceCard />          // per location
│       ├── <RequestForm />              // Zod + react-hook-form
│       └── <RequestHistory />
├── manager/page.tsx
│   └── <ManagerView>
│       └── <PendingRequestList>
│           └── <RequestRow>
│               ├── <BalanceContext />   // forced fresh read
│               └── <ApprovalActions />
└── api/hcm/
    ├── balance/route.ts                 // single-cell read
    ├── balances/route.ts                // batch corpus
    ├── request/route.ts                 // submit
    ├── approve/route.ts                 // manager decision
    └── __dev/
        ├── trigger-anniversary/route.ts
        └── reset/route.ts
```

Routes are physically separate (not toggle-on-state) to enforce separation of concerns and produce shareable URLs (e.g. `/manager?requestId=X`). The header role switcher is an evaluation aid and is excluded from production builds.

### 4.3 State Management & Data Fetching

**Choice: TanStack Query.**

I considered SWR for its smaller footprint and simpler API. For most fetching scenarios it would be the right choice. But the central concerns of this assignment, optimistic mutations with rollback, mid-flight reconciliation, and granular cache invalidation, are exactly the surface where TanStack Query provides primitives that SWR requires you to rebuild manually. Bundle size weight is not significant for an internal HR-platform context. The trade-off favors the tool that lets me focus on the domain logic, not on cache plumbing.

Specifically, TanStack Query gives me:
- `onMutate` / `onError` / `onSettled` lifecycle for optimistic updates with automatic rollback via context
- Hierarchical query keys (`['balance', employeeId, locationId]`) for granular invalidation
- `MutationCache` observability to coordinate background polling with in-flight mutations
- `refetchOnWindowFocus` and configurable `staleTime` out of the box

Alternatives considered:
- **SWR:** simpler, smaller, but optimistic mutations require manual `mutate()` cache surgery. Reconciliation logic would need to be reimplemented.
- **Redux + RTK Query:** overkill for this scope. The boilerplate cost is real on a 48-hour budget.
- **Plain useState + fetch:** ruled out, would require reimplementing dedup, retry, stale-while-revalidate from scratch.

### 4.4 Optimistic vs Pessimistic Updates

I chose a **deliberate asymmetry**: optimistic for employee submission, pessimistic for manager approval.

**Optimistic (employee request submission):**
- High-frequency action where speed matters most
- Cost of being wrong is recoverable: rollback the optimistic state and surface a clear error
- The user expects "I clicked, something happened" UX

**Pessimistic (manager approval):**
- Low-frequency action with high stakes
- The briefing explicitly states: *"the Manager needs to approve requests with confidence that the balance shown is valid at the moment of approval"*
- A 200ms spinner before the approval form opens eliminates the entire category of "approved with stale balance"
- Forced fresh read via single-cell `GET /api/hcm/balance` on row expand, bypassing TanStack cache (`staleTime: 0` for that specific query)

The reality is that neither pure optimism nor pure pessimism is correct. The right move is to mix strategies based on what each user actually needs. Employees submitting a request don't strictly need same-second confirmation that the request was filed, what they need is to feel the action landed and to receive reliable downstream confirmation (an email, a status change in the request history). The optimistic UX serves the perceived responsiveness; the system handles the durability separately. Managers approving a request are different: their action directly mutates the balance and locks in a decision that affects payroll and HR records. Pessimism at that boundary is not friction, it's correctness.


### 4.5 Cache Invalidation Strategy

- **Stale threshold:** 60 seconds for balance queries, aligning with the polling interval (§4.7) so the visual indication of staleness is coherent with the refresh cadence.
- **Mutation success:** invalidate the specific (employeeId, locationId) balance, not the full corpus. Avoids cascading refetches.
- **Window focus:** `refetchOnWindowFocus: true` covers the "user returned from another tab" case without requiring aggressive polling.
- **Mutation in flight:** while a mutation is pending, the cache is locked from background overwrites (see §4.6).

### 4.6 Reconciling Background Refresh with In-Flight Actions

This is the boundary where naive implementations fail. Specifically:

- A background poll lands mid-mutation. The poll's stale snapshot would clobber the user's optimistic update, then resurface again on settlement.
- HCM returns a "successful" response that is silently incorrect. The next reconciliation must detect the drift and notify, not silently overwrite.

The strategy:

1. Track in-flight mutations via `MutationCache.getAll()`. If any mutation is pending for a given (employeeId, locationId), defer the corresponding background refresh.
2. On mutation settlement (success or rollback), apply any deferred refresh as the new authoritative value.
3. If a polled value contradicts a recently-acknowledged mutation result, surface a non-blocking notification ("Your balance has changed since this request was submitted") rather than silently overwriting. This addresses the "silent wrongness" challenge from §3.
4. A complementary safeguard: while a mutation is in flight, the corresponding submit/approve button is disabled and the optimistic state is visually distinct (subtle pending indicator). This prevents the user from re-submitting against a balance that is mid-reconciliation.

### 4.7 Polling Strategy

**Interval:** 60 seconds for the batch corpus endpoint.

The polling is intentionally non-aggressive:
- **Paused when tab is backgrounded** (`refetchIntervalInBackground: false`)
- **Paused during in-flight mutations** (custom predicate in `refetchInterval`)
- **Complemented by `refetchOnWindowFocus`** for the common "user returned to tab" scenario, which covers most freshness needs without requiring tighter polling
- **Exponential backoff on errors** to avoid hammering an already-degraded HCM

The 60-second window is a deliberate trade-off: frequent enough to detect anniversary bonuses within a session that meaningfully impacts UX, infrequent enough to not generate sustained load. In production, this would be informed by analytics on actual anniversary-bonus latency tolerance.

### 4.8 Mock HCM Design

Implemented as Next.js route handlers under `app/api/hcm/*`. Choosing route handlers over MSW because:
- The mock is a first-class part of the running application, not a client-side interception layer
- State (timers, failure injection) lives naturally in module-scoped memory
- Deployed Storybook hits real network calls against real handlers, not browser-side fakes
- The briefing explicitly suggests route handlers as the primary option

MSW retains a role in **integration tests** where I want to inject specific failure modes (forced 5xx, latency spikes) without mutating shared mock state. This dual approach is intentional: route handlers as the production-shape mock, MSW as the test-time scenario injector.

**Endpoints:**

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/hcm/balance` | Single-cell read, query: `employeeId`, `locationId` |
| GET | `/api/hcm/balances` | Batch corpus for an employee |
| POST | `/api/hcm/request` | Submit time-off request |
| POST | `/api/hcm/approve` | Manager decision (approve/deny) |
| POST | `/api/hcm/__dev/trigger-anniversary` | Force anniversary bonus for deterministic tests |
| POST | `/api/hcm/__dev/reset` | Reset module-scoped state |

**Simulated behaviors:**
- **Anniversary bonus:** background timer (90s) selects a random employee and increments their balance silently. Also triggerable via `__dev/trigger-anniversary` for deterministic tests.
- **Silent failures:** 5% default rate of write requests return `200 OK` but do not actually persist. Forceable via `x-mock-force-failure: silent` header.
- **Conflict responses:** insufficient-balance returns `409` with structured error body.
- **Latency simulation:** 100–800ms jitter on reads, 200–1500ms on writes.
- **Mock state:** hardcoded TS object with 3 employees, 2 locations each, varied balances. Reset on dev server restart or via `__dev/reset`.

### 4.9 Validation Layer

Single source of truth: Zod schemas under `lib/validation/`.

The same schemas are imported by:
- Route handlers, for request body validation
- React-Hook-Form on the client, via `zodResolver`
- TanStack Query, for response shape validation

This co-location is deliberate. The agent has a single place to update when domain rules change, eliminating the entire class of "client says valid, server says invalid" desync. It also makes the validation layer itself a first-class testable artifact.

This co-location matters more, not less, in an agentic workflow. When the agent generates code that touches domain rules, having a single canonical schema means every prompt and every diff references the same source of truth. Without it, the agent will independently re-derive validation logic in multiple places, drift will compound silently, and the very speed advantage of agentic development becomes the source of subtle bugs.

### 4.10 Request Lifecycle Modeling

Discriminated union in TypeScript, no state machine library:

```ts
type RequestState =
  | { status: 'draft' }
  | { status: 'optimistic-pending'; submittedAt: Date }
  | { status: 'submitted'; serverId: string }
  | { status: 'rolling-back'; reason: string }
  | { status: 'rejected'; reason: string }
  | { status: 'approved'; approvedBy: string; approvedAt: Date }
  | { status: 'denied'; deniedBy: string; reason: string }
```

Rationale: xstate would be the right tool for a more complex flow with side effects, guards, and parallel states. For this surface area, a discriminated union with TanStack Query as the source-of-truth cache is simpler and just as type-safe, without the additional dependency or learning curve cost in a 48-hour budget.

### 4.11 User Feedback Layer
Two layers of feedback complement the optimistic/pessimistic strategy:

Inline state: UI elements reflect the current request status (pending, rolled-back, approved, denied) via the discriminated union from §4.10. This is the primary signal for users actively watching the screen.
Toast notifications on settlement: when a mutation completes (success or failure), a non-blocking toast confirms the outcome. This covers the case where the user has navigated away from the request row, or where the mutation settles after a background reconciliation. Toasts are transient (5 seconds) for success cases and persistent (require dismissal) for failures, where the user needs to acknowledge the rollback.

## 5. Test Strategy

The product is built with agentic development. The agent writes the code; **my job is to specify and verify**. Tests are the verification layer, the system future contributors cannot silently break.

The development loop follows a TDD shape adapted to agentic execution: I write the Storybook story (or test) describing the desired state, the agent implements until the test passes, then I verify and refine. Storybook plays a dual role here, as both the visual contract and the test harness. This loop closes the feedback gap that ungoverned agentic development typically opens.

### 5.1 Test Tiers

| Tier | Tool | Guards Against |
|------|------|----------------|
| Component tests | Vitest + RTL | Component contracts: props in, behavior out |
| Storybook interaction tests | Storybook + `@storybook/test` | UI state correctness across all visual states |
| Integration tests | Vitest + MSW (test-only) | Data layer behavior: optimistic, rollback, reconciliation, race conditions |
| Schema tests | Vitest + Zod | Validation rules and shared client/server contracts |

### 5.2 What I Am Deliberately Not Testing

- **No E2E tests with Playwright/Cypress.** Cost-benefit doesn't justify on a 48-hour budget. Storybook interaction tests cover the UI surface; integration tests cover the data layer. Full E2E would be redundant.
- **No visual regression beyond Storybook test runner.** Chromatic considered but excluded to keep the deliverable self-contained in the .zip.
- **No load/performance tests.** Out of scope.

### 5.3 Critical Test Cases

At least one integration test per challenge listed in §3:

- Optimistic submission, HCM accepts → cache reflects truth
- Optimistic submission, HCM rejects (409) → rollback + error message visible
- Optimistic submission, HCM returns 200 but is silently wrong → next poll reconciles, user notified non-blockingly
- Anniversary bonus fires mid-session → balance updates without disrupting in-flight action
- Manager opens approval, balance refreshes (forced read) → manager sees fresh number
- Concurrent in-flight mutation + background poll → poll deferred, applied after settlement, no clobbering
- Per-location scoping: action on (employeeId, locationA) does not invalidate (employeeId, locationB)

## 6. Storybook Coverage

Stories for every state listed in the brief, plus a few I add. Storybook is the proof that the state space was thought through, not just the happy path.

**Balance display states:**
- Loading
- Empty (no balances)
- Stale (loaded > 60s ago, subtle visual indicator, no timestamp label)
- Balance-refreshed-mid-session (anniversary bonus visualization)

**Request submission states:**
- Optimistic-pending
- Optimistic-rolled-back (HCM rejected)
- HCM-rejected (insufficient balance, 409)
- HCM-silently-wrong (success response, later contradicted by reconciliation)

**Manager view states:**
- Pending requests list
- Approval modal with fresh-read in progress
- Approval modal with refreshed balance after stale value

**Cross-cutting:**
- Validation errors on form (Zod-driven)

### 6.1 Running Storybook

Storybook runs locally with a single command:

```bash
pnpm install
pnpm storybook
```

Stories are also accessible alongside the running app for end-to-end demonstration of the full state space against the real mock HCM.

vercel link: will be added a vercel link here

## 7. Decisions Deferred / Future Work

Honest about what was traded off:

- **Real-time push (WebSocket/SSE):** would eliminate polling and deliver true real-time anniversary bonus updates, but out of scope for 48 hours. Adding it would require backend coordination beyond the mock.
- **Audit log of optimistic rollbacks:** useful in production for debugging silent failures and building trust with users when things go wrong. Out of scope here.
- **Granular per-location subscription:** current model fetches all locations on hydration. At scale (employees with 20+ locations), this would warrant query-key granularity per location.
- **Authentication and role enforcement:** the role switcher is a demo helper. In production, role would come from session/JWT, and route handlers would enforce authorization.
- **Optimistic UX for manager approval:** considered briefly, rejected. The cost of approving with stale data outweighs the cost of a 200ms spinner. Could revisit if user research showed approval friction.

## 8. Open Questions

- How should the UI behave when HCM is unreachable for > 5 minutes? Block submissions? Allow with explicit "offline" warning?
- Is there a desired audit trail for managers who approve based on what later turns out to be stale data?
- For employees with many locations (10+), is the per-location balance card list still the right UX, or does it need a different treatment?