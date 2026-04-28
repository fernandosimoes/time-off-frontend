# Milestone 6: README, Polish, Submission Package

**Estimated effort:** 2 hours
**Depends on:** Milestones 1-5
**Unblocks:** submission

## Goal

Write the README, do final cleanup, and prepare the .zip for submission.

## Scope

### In scope

0. **Carry-over gaps from M4 / TRD §6** that we deliberately deferred to keep M5 focused:
   - **Console-error guard in Storybook tests.** M3 added a `console.error` spy in `tests/setup/vitest.setup.ts` that fails any unit/integration test that logs an error. The Storybook test runner (`@storybook/addon-vitest`) does not pick that setup up. Add an equivalent guard in `.storybook/preview.tsx` (or a Vitest project setup file scoped to the `storybook` project) so a story that logs a React/RQ warning fails the run. Acceptance criterion in M4 ("render without console errors") is then enforceable, not just visually verified.
   - **`Balance-refreshed-mid-session` story.** TRD §6 lists this as a distinct balance display state and we never built a dedicated visualization for it. Add either: (a) a `BalanceCard` story `BalanceRefreshedMidSession` showing the card with a small "+1 day" badge that fades after 5s, OR (b) a page-level story that triggers `__dev/trigger-anniversary` mid-render and asserts the toast appears. Pick (a) — simpler and isolated to the component layer.

1. **`README.md` at the repo root** with:
   - One-paragraph description of what the project is and what problem it solves
   - Quick start: install, run, run tests, run Storybook (with one command each)
   - Architecture overview in 5-10 lines, pointing to TRD.md for depth
   - Test strategy overview, pointing to TRD §5
   - Storybook coverage overview, pointing to TRD §6
   - Trade-offs and deferred work, condensed from TRD §7
   - Notes on agentic development workflow used (1 paragraph): mention the SDD approach, governance via CLAUDE.md, milestone-based execution
2. **Final code audit:**
   - Remove any TODO comments
   - Remove any console.logs
   - Remove dead imports
   - Verify no `any` or `as unknown as` casts
3. **Verify the runtime:**
   - `pnpm install && pnpm dev` works on a fresh clone (test by deleting node_modules)
   - `pnpm storybook` works
   - `pnpm test:run` passes
   - `pnpm typecheck` clean
4. **Build the .zip:**
   - Exclude `node_modules`, `.next`, `storybook-static`, `coverage`, `.git`
   - Include: source, TRD.md, CLAUDE.md, specs/, README.md, package.json, lockfile, configs
   - Verify size is under 50MB
5. **Submit:**
   - Re-read the original briefing email to verify all requirements met
   - Upload .zip via the Google Form link

### Out of scope

- New features
- Refactors

## README Tone

Write for a senior engineer who is evaluating you. Not marketing, not tutorial, not "About". Just signal:

- What this is
- How to run it
- Where the engineering thinking lives (TRD)
- What was deliberately deferred and why

Keep it under 250 lines.

## Acceptance Criteria

- [ ] Console-error guard added to Storybook tests; running `npm run test:storybook` fails if any story logs a console.error
- [ ] `BalanceRefreshedMidSession` story exists and renders the +1-day visual cue
- [ ] README written, reviewed, no placeholders
- [ ] Fresh clone test passes (verify by archiving and unarchiving locally)
- [ ] .zip is under 50MB
- [ ] All milestones' acceptance criteria still pass on the final state
- [ ] Submission uploaded via the form

## Completion Report Template

Final summary of the entire delivery:

```
Project complete and submitted.

Total time: [hours]
Milestones completed: 6/6
Final test count: [pass]/[total]
Final Storybook story count: [count]
TRD final size: [pages]

Trade-offs made under time pressure:
- [list]

If I had 24 more hours, I would:
- [list, max 5 items]
```

This last list is for you, not the recruiter. It's a private debrief.