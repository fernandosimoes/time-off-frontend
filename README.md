# Time-Off Frontend for ExampleHR

A take-home demonstrating how to build an employee-facing time-off UI on top of an external HCM system that owns the source of truth. The central tension is between speed (the UI must feel instant) and correctness (it must never lie about a balance or a decision). The architecture, tradeoffs, and test strategy live in [`TRD.md`](./TRD.md).

The runnable Next.js app lives in [`app/`](./app). Milestone specs live in [`spec/`](./spec).

## Run

```bash
cd app
npm install
npm run dev          # Next.js + mock HCM on :3000
npm run storybook    # Storybook on :6006
```

## Test

```bash
cd app
npm run test:run     # one-shot Vitest run (unit + integration)
npm run typecheck
npm run lint
```

## Layout

```
agentic-time-off/
├── CLAUDE.md            # project constitution
├── TRD.md               # technical design doc
├── spec/                # milestone specifications
└── app/                 # Next.js project
    ├── app/
    │   ├── api/hcm/     # mock HCM route handlers
    │   ├── employee/    # employee view (placeholder)
    │   └── manager/     # manager view (placeholder)
    ├── lib/hcm/         # mock HCM module-scoped state
    ├── tests/           # Vitest tests
    └── ...
```
