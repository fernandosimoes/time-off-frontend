# Time-Off Frontend for ExampleHR

A take-home demonstrating how to build an employee/manager time-off UI on top of an external HCM system that owns the source of truth. The central tension is between **speed** — the UI must feel instant — and **correctness** — it must never lie about a balance or a decision. This deliverable shows how that tension is resolved with a deliberate mix of optimistic UX (employee submission), pessimistic UX (manager approval), and a reconciliation layer that is honest when HCM disagrees with what we just rendered.

## Live links

- **App:** https://time-off-frontend-psi.vercel.app/  (`/` redirects to `/employee`; `/manager` is the approver surface)
- **Storybook:** https://time-off-storybook-8oo946snx-fernando-simoes-projects-a3a9d0e4.vercel.app/
- **GitHub:** https://github.com/fernandosimoes/time-off-frontend

## Where the engineering thinking lives

- [`TRD.md`](./TRD.md) — full design doc (challenges, solution, alternatives considered, optimistic vs pessimistic, cache invalidation, in-flight reconciliation, polling, component tree, test strategy)
- [`spec/`](./spec) — six milestone specifications used to drive agentic execution (M1 bootstrap → M6 polish)
- [`CLAUDE.md`](./CLAUDE.MD) — project constitution (working method, code principles, stack conventions, definition of done)

## Quick start

The Next.js project lives in [`app/`](./app). All commands run from there.

```bash
cd app
npm install
npm run dev          # Next.js + mock HCM on :3000
npm run storybook    # Storybook on :6006
npm run test:run     # one-shot Vitest run (unit + integration)
npm run test:storybook   # Storybook interaction tests via Playwright headless
npm run typecheck
npm run lint
npm run build        # production build
```

## Architecture in 8 lines

Three layers, top-down: **presentation** (`components/employee`, `components/manager`, all props-driven discriminated unions so stories drive the same components production drives via hooks), **data** (`lib/query/*` — TanStack Query hooks, optimistic mutations with rollback, pause-on-mutation polling predicate, silent-wrongness detection), **domain + validation** (`lib/domain` re-exports types inferred from `lib/validation` Zod schemas — single source of truth shared across route handlers, RHF resolver, and TanStack response parsing). The **mock HCM** lives at `app/api/hcm/*` as Next.js route handlers, sharing module-scoped state with MSW handlers in tests so route logic and test logic exercise the same code path. Full architecture in [TRD §4](./TRD.md#4-proposed-solution).

## Test strategy

Four tiers, deliberate coverage choices, defended in [TRD §5](./TRD.md#5-test-strategy):

| Tier | Tool | Guards Against |
|---|---|---|
| Component contracts | Vitest + RTL | props in, behavior out |
| Storybook interaction tests | `@storybook/addon-vitest` (Playwright headless) | UI state correctness across all visual states |
| Integration / data layer | Vitest + MSW | optimistic, rollback, reconciliation, race conditions, per-location scoping |
| Schema | Vitest + Zod | shared client/server validation contracts |

**Current totals:** 48 unit/integration tests + 40 Storybook stories with 5 interaction tests (3 employee, 2 manager). All seven Critical Test Cases from [TRD §5.3](./TRD.md#53-critical-test-cases) have passing tests. **Deliberately not tested:** E2E with Playwright/Cypress (covered by Storybook interaction tests + integration tests; redundant for this scope), visual regression beyond Storybook test runner, load/performance.

## Storybook coverage

Stories for every meaningful state from [TRD §6](./TRD.md#6-storybook-coverage) plus a few more:

- **Balance display:** loading, empty, fresh, stale, optimistic-pending, rolled-back, error, balance-refreshed-mid-session
- **Request submission:** empty, validation errors, submitting, server error, optimistic-pending, optimistic-rolled-back, HCM-rejected, HCM-silently-wrong (toast)
- **Manager view:** collapsed, expanding-loading, expanded-fresh, expanded-stale-then-refreshed (delta indicator), expanded-fresh-read-failed, idle / approving / denying actions
- **Cross-cutting:** Zod-driven validation errors on form

The page-level stories use [`msw-storybook-addon`](https://github.com/mswjs/msw-storybook-addon) to drive the full state space without a running dev server.

## Trade-offs and deferred work

Honest about what was traded off (see [TRD §7](./TRD.md#7-decisions-deferred--future-work) for full reasoning):

- **No real-time push.** WebSocket/SSE would eliminate polling but requires backend coordination beyond the mock. Polling at 60s with focus-driven refresh covers most of the UX without the operational cost.
- **Request history is mostly client-cached, server-poll-backed.** `useRequestHistory(employeeId)` polls `GET /api/hcm/requests?employeeId=…` every 60s and is also patched optimistically by `useSubmitRequest` and by `useApproveRequest` for instant same-session feedback. Cross-tab sync (different browser sessions) reconciles on the next poll, not via BroadcastChannel.
- **No optimistic UX for manager approval.** Considered, rejected. The cost of approving on stale data outweighs the cost of a 200ms forced fresh-read spinner.
- **No audit log of optimistic rollbacks.** Useful in production for debugging silent failures, out of scope here.
- **Per-location subscription is corpus-batched, not per-cell.** At scale (10+ locations per employee) this would warrant per-cell granularity. Documented as a future optimization.
- **Authentication is hardcoded** (`employeeId='emp-1'`, `managerId='mgr-1'`). Production would source these from session/JWT and route handlers would enforce authorization.

### Caveats specific to deployed mock HCM (Vercel)

- The mock HCM keeps state in module scope. On Vercel each Serverless Function invocation may start a fresh lambda, so balances may "reset" between cold starts. For a deterministic walkthrough, hit `POST /api/hcm/dev/seed` to populate pending requests on demand and `POST /api/hcm/dev/reset` to clear state.
- The 90s anniversary-bonus `setInterval` does not run in serverless (lambdas are killed between requests). Anniversaries on the deployed app must be triggered explicitly via `POST /api/hcm/dev/trigger-anniversary` with `{ "employeeId": "emp-1" }`.
- Storybook interaction tests (`play` functions) only run via `npm run test:storybook` (CI/local). On the deployed Storybook the stories render but the assertions are silent.

## Notes on the agentic workflow

This codebase was built end-to-end via spec-driven agentic development, **no hand-written code**. The workflow:

1. I wrote [`TRD.md`](./TRD.md) (the engineering spec) and [`CLAUDE.md`](./CLAUDE.MD) (the project constitution: working method, code principles, definition of done) by hand.
2. Each milestone in [`spec/`](./spec) was a precise contract — scope, acceptance criteria, completion-report template — written by hand.
3. The agent (Claude Code) implemented each milestone, ran the tests, reported what passed and what was deferred. I verified, redirected when needed (e.g., npm vs pnpm, project layout), and signed off.
4. The agent never improvised scope. If a milestone said `X`, the agent delivered `X`. New scope went back through a spec edit.

The TRD's argument about Zod as a single source of truth ([§4.9](./TRD.md#49-validation-layer)) compounds in this workflow: every prompt and every diff references the same canonical schema, so the agent cannot silently re-derive validation logic in three places. Discipline — schemas in one folder, types inferred, never duplicated — was the difference between fast agentic execution and silent drift.

## Layout

```
agentic-time-off/
├── README.md                # this file
├── CLAUDE.md                # project constitution
├── TRD.md                   # technical design doc
├── spec/                    # M1-M6 milestone specifications
└── app/                     # Next.js project (16 + React 19, Tailwind v4, shadcn/ui)
    ├── app/
    │   ├── api/hcm/         # mock HCM route handlers (per-cell, batch, request, approve, dev/*)
    │   ├── employee/        # employee view (page + interaction stories)
    │   └── manager/         # manager view (page + interaction stories)
    ├── components/
    │   ├── employee/        # BalanceCard, BalanceList, RequestForm, RequestHistory, EmployeeView
    │   ├── manager/         # PendingRequestList, RequestRow, BalanceContext, ApprovalActions, ManagerView
    │   └── ui/              # shadcn primitives (only the ones used)
    ├── lib/
    │   ├── domain/          # types, RequestState discriminated union, isTerminal helper
    │   ├── validation/      # Zod schemas — single source of truth
    │   ├── hcm/             # mock HCM module-scoped state + helpers
    │   └── query/           # TanStack Query client, hooks, refresh-detector, notifications
    └── tests/
        ├── integration/     # hcm.test.ts, schemas.test.ts, data-layer.test.tsx
        └── setup/           # vitest.setup.ts (NODE_ENV gate, console-error guard), msw.ts
```
