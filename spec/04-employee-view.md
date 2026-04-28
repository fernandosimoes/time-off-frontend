# Milestone 4: Employee View + Storybook

**Estimated effort:** 8 hours
**Depends on:** Milestones 1, 2, 3
**Unblocks:** Milestone 5

## Goal

Build the Employee view that consumes the data layer hooks, plus the Storybook stories that demonstrate every meaningful state. This is where the user-facing UI starts.

## Scope

### In scope

1. **Add shadcn/ui components on demand:** Button, Card, Input, Label, Toast, Form, Calendar, Popover, Alert. Don't add components that aren't used.
2. **Components in `components/employee/`:**
   - `BalanceCard`: shows balance for one (employeeId, locationId), with visual state for fresh/stale/loading/error
   - `BalanceList`: maps over balances and renders cards
   - `RequestForm`: react-hook-form + Zod resolver, fields: location (dropdown), startDate, endDate, days (computed)
   - `RequestHistory`: lists the user's recent requests with their lifecycle status from the discriminated union
3. **Page at `app/employee/page.tsx`** that composes the above with hardcoded `employeeId='emp-1'` (in production this would come from auth)
4. **Toast wiring:** subscribe to the notification system from Milestone 3, render toasts via shadcn's Toast primitive
5. **Storybook stories** for every state listed in TRD §6 under "Balance display states", "Request submission states", and the form validation cross-cutting story
6. **Storybook interaction tests** for the form: submit valid → optimistic state visible; submit invalid → form error visible; submit causing 409 → rolled-back state visible

### Out of scope

- Manager view (Milestone 5)
- Animations beyond shadcn defaults
- Mobile responsive beyond what Tailwind gives for free

## Specifications

### `BalanceCard` visual states

Use a discriminated union prop:

```ts
type BalanceCardState =
  | { kind: 'loading' }
  | { kind: 'empty'; locationName: string }
  | { kind: 'fresh'; balance: BalanceCell; locationName: string }
  | { kind: 'stale'; balance: BalanceCell; locationName: string }
  | { kind: 'optimistic-pending'; balance: BalanceCell; locationName: string; pendingDelta: number }
  | { kind: 'rolled-back'; balance: BalanceCell; locationName: string; reason: string }
  | { kind: 'error'; locationName: string; message: string }
```

The component is a pure function of state. The page wires the hook results into this prop.

This split is deliberate: stories drive the component via props, real usage drives via hooks. Same component, two callers, no branching logic inside.

### `RequestForm` behavior

- Fields validated on blur
- Submit button disabled while a mutation is in flight (per TRD §4.6 point 4)
- On `useSubmitRequest` success: form resets, toast confirms ("Request submitted")
- On `useSubmitRequest` error: form retains values, toast shows error, no rollback visible to user (cache rollback is automatic)
- On silent-failure-detected notification: persistent toast with "Your last request was not recorded by HCM. Please retry."

### Stories required

- `BalanceCard`: 7 stories, one per `kind`
- `BalanceList`: 3 stories (empty, mixed states across locations, all loading)
- `RequestForm`: 4 stories (empty, with validation errors, submitting, error from server)
- `RequestHistory`: 3 stories (empty, mixed statuses, only pending)
- Page-level: 1 story showing the full Employee view in a typical state (use MSW to control the data)

## Acceptance Criteria

- [ ] All required stories exist and render without console errors
- [ ] At least 3 Storybook interaction tests pass:
  - Submit a valid form → optimistic state appears
  - Submit a form that exceeds balance → error message appears, state rolls back
  - Trigger a `silent-failure-detected` notification → persistent toast renders
- [ ] The page at `/employee` works end-to-end against the real mock HCM
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:run`, `pnpm storybook` (no console errors) all clean
- [ ] No prop drilling deeper than 2 levels (hook usage stays close to where data is needed)

## Completion Report Template

Same template. Add: screenshots or a short description of what each story looks like, so the human can spot-check coverage without running Storybook.