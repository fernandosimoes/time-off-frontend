# Milestone 5: Manager View + Storybook

**Estimated effort:** 6 hours
**Depends on:** Milestones 1-4
**Unblocks:** Milestone 6

## Goal

Build the Manager view, which exercises the **pessimistic** approval path described in TRD §4.4. Different stakes, different UX.

## Scope

### In scope

1. **Components in `components/manager/`:**
   - `PendingRequestList`: shows all `pending` requests across employees
   - `RequestRow`: a row that, when expanded, triggers a forced fresh balance read and shows approval/deny controls
   - `BalanceContext`: small inline display of the fresh balance, with a loading state during the forced read
   - `ApprovalActions`: approve/deny buttons, disabled during the fresh-read and during the approve mutation
2. **Page at `app/manager/page.tsx`** with hardcoded `managerId='mgr-1'`
3. **A way to seed pending requests** for demo purposes: either a `__dev` endpoint that creates 3 pending requests, or auto-seeded on dev server start. Pick the simpler one.
4. **Storybook stories** per TRD §6 "Manager view states" + "Cross-cutting" relevant ones not covered in Milestone 4
5. **Storybook interaction tests** for the approval flow

### Out of scope

- Filters, search, pagination on the request list (out of scope for take-home)
- Bulk approval

## Specifications

### Forced fresh read on row expand

When `RequestRow` expands:
1. Call `useBalance(employeeId, locationId, { freshOnly: true })`
2. Show a small loading indicator next to the balance during the fetch
3. Render `BalanceContext` with the fresh value once loaded
4. Approval buttons remain disabled until the fresh read completes
5. If the fresh read fails, show an error and a "Retry" button. Approval is blocked until a successful fresh read

This implements TRD §4.4 pessimistic strategy literally.

### Stories required

- `RequestRow`: 5 stories (collapsed, expanding-loading, expanded-fresh, expanded-stale-then-refreshed, expanded-fresh-read-failed)
- `ApprovalActions`: 3 stories (idle, approving, denying)
- `PendingRequestList`: 3 stories (empty, mixed statuses, all pending)
- Page-level: 1 story showing typical Manager view

## Acceptance Criteria

- [ ] Manager can approve a pending request, balance state in cache reflects the approval
- [ ] When approving with a stale-balance situation, the fresh read happens before approval is enabled (verify by triggering an anniversary bonus between submit and approve)
- [ ] All required stories render
- [ ] At least 2 Storybook interaction tests pass for the approval flow
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:run` all clean

## Completion Report Template

Same template.