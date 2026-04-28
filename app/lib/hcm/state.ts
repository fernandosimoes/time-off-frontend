// Module-scoped, in-memory mock HCM state.
//
// Lifecycle:
// - Seed is captured once on import and used by `resetState()`.
// - The anniversary-bonus timer starts on first import in non-test envs.
// - All mutations go through helpers in this file so tests can rely on `resetState()`.

import type { BalanceCell, Employee, Location, TimeOffRequest } from '@/lib/domain'

// Re-export so the rest of the codebase can keep importing from @/lib/hcm/state
// during the M1 → M2 transition. The canonical declarations live in @/lib/domain.
export type { BalanceCell, Employee, Location, TimeOffRequest }

const SEED_EMPLOYEES: Employee[] = [
  { id: 'emp-1', name: 'Ana', hireDate: new Date('2023-04-30T00:00:00Z') },
  { id: 'emp-2', name: 'Bruno', hireDate: new Date('2024-12-01T00:00:00Z') },
  { id: 'emp-3', name: 'Carla', hireDate: new Date('2022-04-29T00:00:00Z') },
]

const SEED_LOCATIONS: Location[] = [
  { id: 'loc-1', name: 'Headquarters' },
  { id: 'loc-2', name: 'Remote' },
]

// 6 cells: emp-1×{loc-1=10, loc-2=5}, emp-2×{loc-1=15, loc-2=3}, emp-3×{loc-1=0, loc-2=20}
const SEED_BALANCES: BalanceCell[] = [
  { employeeId: 'emp-1', locationId: 'loc-1', daysAvailable: 10, lastUpdated: new Date('2026-04-27T00:00:00Z') },
  { employeeId: 'emp-1', locationId: 'loc-2', daysAvailable: 5, lastUpdated: new Date('2026-04-27T00:00:00Z') },
  { employeeId: 'emp-2', locationId: 'loc-1', daysAvailable: 15, lastUpdated: new Date('2026-04-27T00:00:00Z') },
  { employeeId: 'emp-2', locationId: 'loc-2', daysAvailable: 3, lastUpdated: new Date('2026-04-27T00:00:00Z') },
  { employeeId: 'emp-3', locationId: 'loc-1', daysAvailable: 0, lastUpdated: new Date('2026-04-27T00:00:00Z') },
  { employeeId: 'emp-3', locationId: 'loc-2', daysAvailable: 20, lastUpdated: new Date('2026-04-27T00:00:00Z') },
]

let employees: Employee[] = cloneEmployees(SEED_EMPLOYEES)
let locations: Location[] = cloneLocations(SEED_LOCATIONS)
let balances: BalanceCell[] = cloneBalances(SEED_BALANCES)
let requests: Map<string, TimeOffRequest> = new Map()

function cloneEmployees(src: Employee[]): Employee[] {
  return src.map((e) => ({ ...e, hireDate: new Date(e.hireDate) }))
}
function cloneLocations(src: Location[]): Location[] {
  return src.map((l) => ({ ...l }))
}
function cloneBalances(src: BalanceCell[]): BalanceCell[] {
  return src.map((b) => ({ ...b, lastUpdated: new Date(b.lastUpdated) }))
}

export function resetState(): void {
  employees = cloneEmployees(SEED_EMPLOYEES)
  locations = cloneLocations(SEED_LOCATIONS)
  balances = cloneBalances(SEED_BALANCES)
  requests = new Map()
  forcedLatency = null
  forcedSilentFailure = false
}

export function listEmployees(): Employee[] {
  return employees.map((e) => ({ ...e, hireDate: new Date(e.hireDate) }))
}

export function findEmployee(employeeId: string): Employee | undefined {
  const found = employees.find((e) => e.id === employeeId)
  return found ? { ...found, hireDate: new Date(found.hireDate) } : undefined
}

export function findLocation(locationId: string): Location | undefined {
  const found = locations.find((l) => l.id === locationId)
  return found ? { ...found } : undefined
}

export function getBalance(employeeId: string, locationId: string): BalanceCell | undefined {
  const cell = balances.find((b) => b.employeeId === employeeId && b.locationId === locationId)
  return cell ? { ...cell, lastUpdated: new Date(cell.lastUpdated) } : undefined
}

export function listBalancesForEmployee(employeeId: string): BalanceCell[] {
  return balances
    .filter((b) => b.employeeId === employeeId)
    .map((b) => ({ ...b, lastUpdated: new Date(b.lastUpdated) }))
}

export type DecrementResult =
  | { ok: true; cell: BalanceCell }
  | { ok: false; reason: 'NOT_FOUND' }
  | { ok: false; reason: 'INSUFFICIENT_BALANCE'; available: number }

export function decrementBalance(
  employeeId: string,
  locationId: string,
  days: number,
): DecrementResult {
  const cell = balances.find((b) => b.employeeId === employeeId && b.locationId === locationId)
  if (!cell) return { ok: false, reason: 'NOT_FOUND' }
  if (cell.daysAvailable < days) {
    return { ok: false, reason: 'INSUFFICIENT_BALANCE', available: cell.daysAvailable }
  }
  cell.daysAvailable -= days
  cell.lastUpdated = new Date()
  return { ok: true, cell: { ...cell, lastUpdated: new Date(cell.lastUpdated) } }
}

export function applyAnniversaryFor(employeeId: string): BalanceCell[] {
  const updated: BalanceCell[] = []
  for (const cell of balances) {
    if (cell.employeeId === employeeId) {
      cell.daysAvailable += 1
      cell.lastUpdated = new Date()
      updated.push({ ...cell, lastUpdated: new Date(cell.lastUpdated) })
    }
  }
  return updated
}

export function createRequest(input: {
  employeeId: string
  locationId: string
  days: number
  startDate: string
  endDate: string
}): TimeOffRequest {
  const now = new Date().toISOString()
  const record: TimeOffRequest = {
    id: crypto.randomUUID(),
    employeeId: input.employeeId,
    locationId: input.locationId,
    days: input.days,
    startDate: input.startDate,
    endDate: input.endDate,
    status: 'pending',
    createdAt: now,
  }
  requests.set(record.id, record)
  return { ...record }
}

export function getRequest(requestId: string): TimeOffRequest | undefined {
  const r = requests.get(requestId)
  return r ? { ...r } : undefined
}

export function listRequestsByStatus(
  status: TimeOffRequest['status'],
): TimeOffRequest[] {
  return Array.from(requests.values())
    .filter((r) => r.status === status)
    .map((r) => ({ ...r }))
}

export function listRequests(filter: {
  employeeId?: string
  status?: TimeOffRequest['status']
}): TimeOffRequest[] {
  return Array.from(requests.values())
    .filter((r) => {
      if (filter.employeeId && r.employeeId !== filter.employeeId) return false
      if (filter.status && r.status !== filter.status) return false
      return true
    })
    .map((r) => ({ ...r }))
}

// Demo seed: deterministically creates 3 pending requests across the seeded
// employees so the manager view has something to show on a fresh server. Idempotent — calling
// it again wipes prior pending requests and re-creates the same set.
export function seedPendingRequests(): TimeOffRequest[] {
  for (const [id, r] of requests.entries()) {
    if (r.status === 'pending') requests.delete(id)
  }
  const seedSpecs = [
    { employeeId: 'emp-1', locationId: 'loc-1', days: 3, startDate: '2026-05-04', endDate: '2026-05-06' },
    { employeeId: 'emp-2', locationId: 'loc-1', days: 5, startDate: '2026-05-11', endDate: '2026-05-15' },
    { employeeId: 'emp-3', locationId: 'loc-2', days: 2, startDate: '2026-05-18', endDate: '2026-05-19' },
  ]
  return seedSpecs.map((spec) => createRequest(spec))
}

export function decideRequest(
  requestId: string,
  decision: 'approve' | 'deny',
  managerId: string,
): TimeOffRequest | undefined {
  const r = requests.get(requestId)
  if (!r) return undefined
  r.status = decision === 'approve' ? 'approved' : 'denied'
  r.decidedAt = new Date().toISOString()
  r.decidedBy = managerId
  return { ...r }
}

// Test-only overrides. These let scenario helpers in tests/setup/msw.ts force
// specific behaviors deterministically without monkey-patching internals.
let forcedLatency: { min: number; max: number } | null = null
let forcedSilentFailure = false

export function forceLatency(min: number, max?: number): void {
  forcedLatency = { min, max: max ?? min }
}
export function clearForcedLatency(): void {
  forcedLatency = null
}
export function forceSilentFailure(on: boolean): void {
  forcedSilentFailure = on
}

// Random latency injection. Use Math.random() since determinism is not needed
// for jitter (tests don't assert on timing).
export async function jitter(minMs: number, maxMs: number): Promise<void> {
  const range = forcedLatency ?? { min: minMs, max: maxMs }
  const delay = range.min + Math.random() * (range.max - range.min)
  await new Promise((resolve) => setTimeout(resolve, delay))
}

// Silent-failure injection for write endpoints.
// In test env: only the explicit header (or `forceSilentFailure(true)`)
// triggers a failure — no random dice. In other envs: header forces,
// otherwise 5% random chance.
const SILENT_FAILURE_HEADER = 'x-mock-force-failure'
export function shouldFailSilently(req: Request): boolean {
  if (forcedSilentFailure) return true
  if (req.headers.get(SILENT_FAILURE_HEADER) === 'silent') return true
  if (process.env.NODE_ENV === 'test') return false
  return Math.random() < 0.05
}

// Anniversary-bonus background timer. Picks a random employee every 90s and
// gives every cell of theirs +1 day. Disabled in test env to keep tests deterministic.
const ANNIVERSARY_INTERVAL_MS = 90_000
let anniversaryTimer: ReturnType<typeof setInterval> | null = null

function startAnniversaryTimer(): void {
  if (anniversaryTimer) return
  if (process.env.NODE_ENV === 'test') return
  anniversaryTimer = setInterval(() => {
    if (employees.length === 0) return
    const idx = Math.floor(Math.random() * employees.length)
    const target = employees[idx]
    if (!target) return
    applyAnniversaryFor(target.id)
  }, ANNIVERSARY_INTERVAL_MS)
}

startAnniversaryTimer()
