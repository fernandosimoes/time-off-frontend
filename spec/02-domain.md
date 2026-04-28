# Milestone 2: Domain Layer + Validation

**Estimated effort:** 3 hours
**Depends on:** Milestone 1 (mock HCM running)
**Unblocks:** Milestone 3 (data layer)

## Goal

Build the domain layer: types, discriminated unions, and Zod schemas. By the end of this milestone, every domain concept has a single canonical definition that the rest of the codebase imports. No UI, no fetching, just types and validation.

This is the foundation for the agentic workflow argument: a single source of truth that the agent (and humans) reference everywhere.

## Scope

### In scope

1. **Install Zod** and configure
2. **Domain types** in `lib/domain/`:
   - `request.ts`: `RequestState` discriminated union (per TRD §4.10) + the persisted `TimeOffRequest` shape
   - `balance.ts`: `BalanceCell` type, plus `BalanceFreshness` discriminated union (`'fresh' | 'stale' | 'unknown'`)
   - `employee.ts`: `Employee`, `Location` types
   - `index.ts`: barrel export
3. **Zod schemas** in `lib/validation/`:
   - `request.ts`: `SubmitRequestSchema`, `ApproveRequestSchema`, `TimeOffRequestSchema`
   - `balance.ts`: `BalanceCellSchema`, `BalancesResponseSchema`
   - `errors.ts`: `HcmErrorSchema` for the structured error responses (`INSUFFICIENT_BALANCE`, `NOT_FOUND`)
   - `index.ts`: barrel export
4. **Refactor mock HCM (from Milestone 1) to use the schemas:**
   - Route handlers parse incoming bodies with `.safeParse()`
   - Outgoing responses are validated against the schemas in dev (assertion only, not blocking)
   - The mock state internal types align with the domain types (no parallel definitions)
5. **Schema tests** in `tests/integration/schemas.test.ts`

### Out of scope

- React-Hook-Form integration (Milestone 4 when forms appear)
- TanStack Query integration (Milestone 3)
- Any UI

## Specifications

### `RequestState` discriminated union

Match the TRD §4.10 exactly. Include a helper function `isTerminal(state: RequestState): boolean` that returns true for `approved`, `denied`, `rejected`. This is the kind of helper the discriminated union enables, useful in the UI layer later.

### Schema design rules

- **Dates as ISO strings on the wire, `Date` objects in domain code.** Use Zod transforms (`.transform(s => new Date(s))`) at the boundary
- **Days must be a positive integer.** `z.number().int().positive()`
- **Status enums explicit.** No magic strings
- **Schemas exportable both as runtime parsers and as inferred types.** Pattern: `export const FooSchema = z.object(...)` and `export type Foo = z.infer<typeof FooSchema>`

### Refactoring the mock

In Milestone 1, the route handlers did manual checks. Replace those with `Schema.safeParse(await req.json())`. On parse failure, return 400 with the Zod error tree.

The internal mock state can keep its current shape but the boundary types (what comes in via request body, what goes out as response) must match the schemas.

## Acceptance Criteria

- [ ] Every type in `lib/domain/` has a corresponding test that exercises at least one valid and one invalid case via the matching schema
- [ ] All route handlers from Milestone 1 use Zod `.safeParse()` for input
- [ ] All Milestone 1 tests still pass after the refactor
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] No domain type defined more than once across the codebase (audit imports)
- [ ] `tests/integration/schemas.test.ts` exists and tests:
  - Valid `SubmitRequestSchema` parses correctly
  - Invalid days (zero, negative, non-integer) fails parsing
  - Invalid date strings fail parsing
  - `HcmErrorSchema` accepts both `INSUFFICIENT_BALANCE` and `NOT_FOUND` shapes

## Completion Report Template

Same template as Milestone 1. Add: a list of every schema and the type it infers, so the human can verify the canonical map at a glance.