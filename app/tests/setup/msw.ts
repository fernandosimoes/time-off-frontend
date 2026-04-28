// MSW server for the data layer integration tests.
//
// Strategy: each handler delegates straight to the corresponding Next.js
// route handler from `@/app/api/hcm/*`. Both run in the same Node process
// during Vitest, sharing the module-scoped state in `lib/hcm/state.ts`.
// This means the tests exercise the same code paths as the dev server,
// not a parallel implementation that could drift.

import { http, type HttpHandler } from 'msw'
import { setupServer } from 'msw/node'

import { GET as balanceGET } from '@/app/api/hcm/balance/route'
import { GET as balancesGET } from '@/app/api/hcm/balances/route'
import { POST as approvePOST } from '@/app/api/hcm/approve/route'
import { POST as requestPOST } from '@/app/api/hcm/request/route'
import { GET as requestsGET } from '@/app/api/hcm/requests/route'
import { POST as resetPOST } from '@/app/api/hcm/dev/reset/route'
import { POST as seedPOST } from '@/app/api/hcm/dev/seed/route'
import { POST as triggerAnniversaryPOST } from '@/app/api/hcm/dev/trigger-anniversary/route'
import {
  decrementBalance,
  forceLatency,
  forceSilentFailure,
  resetState,
} from '@/lib/hcm/state'

const handlers: HttpHandler[] = [
  http.get('/api/hcm/balance', ({ request }) => balanceGET(request)),
  http.get('/api/hcm/balances', ({ request }) => balancesGET(request)),
  http.get('/api/hcm/requests', ({ request }) => requestsGET(request)),
  http.post('/api/hcm/request', ({ request }) => requestPOST(request)),
  http.post('/api/hcm/approve', ({ request }) => approvePOST(request)),
  http.post('/api/hcm/dev/trigger-anniversary', ({ request }) =>
    triggerAnniversaryPOST(request),
  ),
  http.post('/api/hcm/dev/reset', () => resetPOST()),
  http.post('/api/hcm/dev/seed', () => seedPOST()),
]

export const server = setupServer(...handlers)

// Scenario helpers exposed to tests. Each one sets a deterministic mock
// behavior and is reset by `resetMockState()` (called in afterEach).
export { forceLatency, forceSilentFailure }

/**
 * Drain the cell at (employeeId, locationId) so the next submit hits the
 * INSUFFICIENT_BALANCE branch, regardless of what the seed says.
 */
export function forceConflict(employeeId: string, locationId: string): void {
  // Decrement to zero by repeatedly subtracting whatever's left.
  // This never throws — decrementBalance refuses below zero.
  for (let i = 0; i < 100; i++) {
    const result = decrementBalance(employeeId, locationId, 1)
    if (!result.ok) break
  }
}

/**
 * Reset all mock-HCM state (seeded data + scenario overrides) between tests.
 */
export function resetMockState(): void {
  resetState()
}
