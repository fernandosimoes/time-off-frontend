import { afterEach, beforeEach } from 'vitest'

import '@testing-library/jest-dom/vitest'

// Force NODE_ENV=test before any module that gates on it is imported.
// Vitest 4 does not set this automatically the way earlier versions did, and
// lib/hcm/state.ts uses NODE_ENV to disable both the anniversary-bonus
// setInterval and the 5% silent-failure dice roll. Without this, tests
// flake when the dice rolls a silent failure mid-write.
;(process.env as Record<string, string>).NODE_ENV = 'test'

// Fail tests on unexpected console.error (M3 acceptance: no React or
// TanStack Query console errors). Warnings are still logged but do not fail
// — many libraries warn about unrelated environmental things in jsdom.
let capturedErrors: string[] = []
const originalConsoleError = console.error

beforeEach(() => {
  capturedErrors = []
  console.error = (...args: unknown[]) => {
    capturedErrors.push(args.map((a) => (a instanceof Error ? a.stack ?? a.message : String(a))).join(' '))
    originalConsoleError(...args)
  }
})

afterEach(() => {
  console.error = originalConsoleError
  if (capturedErrors.length > 0) {
    const joined = capturedErrors.map((e, i) => `  [${i}] ${e}`).join('\n')
    throw new Error(`Test produced ${capturedErrors.length} console.error call(s):\n${joined}`)
  }
})
