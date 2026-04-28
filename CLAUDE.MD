# CLAUDE.md

This file is the project constitution. Read it before doing any work in this repository.

## Project Context

This project is a Time-Off frontend for ExampleHR, a fictional HR platform. It demonstrates how to build a UI layer that talks to an external HCM system (Workday-like) as the source of truth, while maintaining instant UX and correctness guarantees.The full architecture and design decisions live in `TRD.md`. **Read TRD.md before generating any non-trivial code.**

The deliverable is evaluated on:
1. Quality of the technical specification (TRD)
2. Rigor of tests (Storybook stories, integration tests, schema tests)
3. Architectural decisions and their defense
4. Code quality, in that order

## Working Method

This project follows Spec-Driven Development. The workflow is:

1. Human writes a milestone spec in `specs/`
2. Agent reads the spec, the TRD, and this file
3. Agent implements the milestone, running tests as it goes
4. Agent reports completion with: what was done, what tests pass, what is deferred
5. Human verifies and refines

**The agent does not improvise scope.** If a milestone spec asks for X, the agent delivers X, even if Y feels like a natural extension. New scope goes back through the spec.

## Code Principles

### Simplicity over cleverness
- "The basics done right" is the project's design philosophy
- No premature abstraction. If a hook is used in one place, it stays inline until it has a second consumer
- No design patterns invoked by name in code or comments. Patterns are emergent

### Type safety as the contract
- Strict TypeScript. No `any`. No `as unknown as` casts to silence the compiler
- Discriminated unions over boolean flags for state
- Zod schemas as the single source of truth for runtime + compile-time validation

### Tests as specifications
- TDD shape: write the test or Storybook story first, implement until green
- Storybook stories are tests. Every meaningful UI state has a story
- Integration tests cover the data layer behaviors that matter (optimistic, rollback, race conditions)
- No tests for trivial getters, no snapshot tests for the sake of it

### Error handling honesty
- Never swallow errors silently. Surface them or log them
- HCM responses are not trusted. A 200 OK can still be silently wrong
- Optimistic updates always have an explicit rollback path

## Stack and Conventions

### Stack
- Next.js 14+ App Router
- TypeScript strict
- TanStack Query v5
- Zod + react-hook-form
- Tailwind + shadcn/ui (only the components actually used)
- Vitest + React Testing Library
- Storybook 8 with `@storybook/test`
- MSW (test-only, for integration tests)
- pnpm as package manager

### File structure
```
app/
├── employee/page.tsx
├── manager/page.tsx
├── api/hcm/
│   ├── balance/route.ts
│   ├── balances/route.ts
│   ├── request/route.ts
│   ├── approve/route.ts
│   └── __dev/
│       ├── trigger-anniversary/route.ts
│       └── reset/route.ts
└── layout.tsx

components/
├── employee/
├── manager/
├── shared/
└── ui/                    // shadcn primitives only

lib/
├── validation/            // Zod schemas (single source of truth)
├── domain/                // types, discriminated unions, pure logic
├── hcm/                   // mock HCM module-scoped state and helpers
└── query/                 // TanStack Query hooks and client config

stories/                   // co-located alongside components is fine too
tests/
├── integration/
└── setup/
```

Co-locate test files next to the component (`Component.tsx` + `Component.test.tsx` + `Component.stories.tsx`). Integration tests for the data layer live in `tests/integration/` because they cross multiple files.

### Naming
- Components: PascalCase (`BalanceCard.tsx`)
- Hooks: camelCase prefixed `use` (`useBalance.ts`)
- Zod schemas: PascalCase suffixed `Schema` (`TimeOffRequestSchema`)
- Discriminated union types: PascalCase, the discriminant is always `status` or `kind`
- Mock state functions: prefixed `mock` only when test-only; otherwise the function name describes intent

### Imports
- Absolute imports via `@/` aliases (e.g. `@/lib/domain/request`)
- No circular imports. If you need to break one, the abstraction is wrong

## Things This Project Deliberately Does Not Have

- No state machine library (xstate). Discriminated unions are sufficient
- No Redux. TanStack Query is the cache, React state is the rest
- No CSS-in-JS. Tailwind only
- No global stores beyond the QueryClient
- No E2E tests with Playwright/Cypress. Storybook + integration tests cover the surface
- No real authentication. Role is a query param or path
- No persistence beyond module-scoped memory in the mock

## Commands

```bash
pnpm install                # install deps
pnpm dev                    # run Next.js + mock HCM
pnpm storybook              # run Storybook on :6006
pnpm test                   # run Vitest in watch mode
pnpm test:run               # single-pass test run for CI
pnpm typecheck              # tsc --noEmit
pnpm lint                   # eslint
pnpm build                  # production build
```

## What to Do When Stuck

If the spec is ambiguous, the agent asks the human in plain language. It does not improvise. Examples of valid questions:

- "The spec says X, but Y is also a reasonable interpretation. Which one?"
- "Implementing X requires a decision about Z that isn't in the TRD. Defer or decide?"
- "Test for X is failing in a way that suggests the spec is internally inconsistent. Halt and clarify?"

If the human is unavailable, the agent picks the simpler interpretation, implements it, and flags the choice prominently in the completion report.

## Definition of Done for Any Milestone

A milestone is done when:
1. All acceptance criteria in the milestone spec are met
2. `pnpm typecheck` passes with zero errors
3. `pnpm test:run` passes
4. Relevant Storybook stories render without console errors
5. The completion report lists what was done, what tests pass, and what (if anything) was deferred with rationale