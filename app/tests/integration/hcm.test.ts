import { beforeEach, describe, expect, it } from 'vitest'

import { GET as getBalance } from '@/app/api/hcm/balance/route'
import { GET as getBalances } from '@/app/api/hcm/balances/route'
import { POST as submitRequest } from '@/app/api/hcm/request/route'
import { POST as triggerAnniversary } from '@/app/api/hcm/dev/trigger-anniversary/route'
import { POST as resetMock } from '@/app/api/hcm/dev/reset/route'
import type { BalanceCell, TimeOffRequest } from '@/lib/hcm/state'

const ORIGIN = 'http://test.local'

function url(path: string): string {
  return `${ORIGIN}${path}`
}

beforeEach(async () => {
  await resetMock()
})

describe('GET /api/hcm/balance', () => {
  it('returns the cell for a known (employeeId, locationId)', async () => {
    const res = await getBalance(new Request(url('/api/hcm/balance?employeeId=emp-1&locationId=loc-1')))
    expect(res.status).toBe(200)
    const body = (await res.json()) as BalanceCell
    expect(body.employeeId).toBe('emp-1')
    expect(body.locationId).toBe('loc-1')
    expect(body.daysAvailable).toBe(10)
  })

  it('returns 404 for an unknown locationId', async () => {
    const res = await getBalance(new Request(url('/api/hcm/balance?employeeId=emp-1&locationId=loc-unknown')))
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('NOT_FOUND')
  })
})

describe('GET /api/hcm/balances', () => {
  it('returns 2 cells for emp-1', async () => {
    const res = await getBalances(new Request(url('/api/hcm/balances?employeeId=emp-1')))
    expect(res.status).toBe(200)
    const body = (await res.json()) as BalanceCell[]
    expect(body).toHaveLength(2)
  })
})

describe('POST /api/hcm/request', () => {
  it('decrements the balance on success', async () => {
    const submit = await submitRequest(
      new Request(url('/api/hcm/request'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          days: 3,
          startDate: '2026-05-01',
          endDate: '2026-05-03',
        }),
      }),
    )
    expect(submit.status).toBe(200)
    const submitBody = (await submit.json()) as TimeOffRequest
    expect(submitBody.status).toBe('pending')

    const after = await getBalance(new Request(url('/api/hcm/balance?employeeId=emp-1&locationId=loc-1')))
    const afterBody = (await after.json()) as BalanceCell
    expect(afterBody.daysAvailable).toBe(7)
  })

  it('returns 409 INSUFFICIENT_BALANCE when over balance', async () => {
    const res = await submitRequest(
      new Request(url('/api/hcm/request'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          employeeId: 'emp-3',
          locationId: 'loc-1',
          days: 1,
          startDate: '2026-05-01',
          endDate: '2026-05-01',
        }),
      }),
    )
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string; requested: number; available: number }
    expect(body.error).toBe('INSUFFICIENT_BALANCE')
    expect(body.requested).toBe(1)
    expect(body.available).toBe(0)
  })

  it('with x-mock-force-failure: silent returns 200 but does not mutate state', async () => {
    const res = await submitRequest(
      new Request(url('/api/hcm/request'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-mock-force-failure': 'silent',
        },
        body: JSON.stringify({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          days: 4,
          startDate: '2026-05-01',
          endDate: '2026-05-04',
        }),
      }),
    )
    expect(res.status).toBe(200)

    const after = await getBalance(new Request(url('/api/hcm/balance?employeeId=emp-1&locationId=loc-1')))
    const afterBody = (await after.json()) as BalanceCell
    expect(afterBody.daysAvailable).toBe(10)
  })
})

describe('POST /api/hcm/dev/trigger-anniversary', () => {
  it('adds 1 day to every cell of the given employee', async () => {
    const res = await triggerAnniversary(
      new Request(url('/api/hcm/dev/trigger-anniversary'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ employeeId: 'emp-1' }),
      }),
    )
    expect(res.status).toBe(200)

    const loc1 = (await (
      await getBalance(new Request(url('/api/hcm/balance?employeeId=emp-1&locationId=loc-1')))
    ).json()) as BalanceCell
    const loc2 = (await (
      await getBalance(new Request(url('/api/hcm/balance?employeeId=emp-1&locationId=loc-2')))
    ).json()) as BalanceCell
    expect(loc1.daysAvailable).toBe(11)
    expect(loc2.daysAvailable).toBe(6)
  })
})

describe('POST /api/hcm/dev/reset', () => {
  it('restores state to the seed', async () => {
    await submitRequest(
      new Request(url('/api/hcm/request'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          days: 5,
          startDate: '2026-05-01',
          endDate: '2026-05-05',
        }),
      }),
    )
    const beforeReset = (await (
      await getBalance(new Request(url('/api/hcm/balance?employeeId=emp-1&locationId=loc-1')))
    ).json()) as BalanceCell
    expect(beforeReset.daysAvailable).toBe(5)

    await resetMock()

    const afterReset = (await (
      await getBalance(new Request(url('/api/hcm/balance?employeeId=emp-1&locationId=loc-1')))
    ).json()) as BalanceCell
    expect(afterReset.daysAvailable).toBe(10)
  })
})
