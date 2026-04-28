import { describe, expect, it } from 'vitest'

import {
  ApproveRequestSchema,
  BalanceCellSchema,
  BalancesResponseSchema,
  EmployeeSchema,
  HcmErrorSchema,
  LocationSchema,
  RequestStatusSchema,
  SubmitRequestSchema,
  TimeOffRequestSchema,
} from '@/lib/validation'

describe('SubmitRequestSchema', () => {
  const valid = {
    employeeId: 'emp-1',
    locationId: 'loc-1',
    days: 3,
    startDate: '2026-05-01',
    endDate: '2026-05-03',
  }

  it('accepts a well-formed submission', () => {
    const result = SubmitRequestSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it.each([0, -1, 1.5])('rejects invalid days: %s', (days) => {
    const result = SubmitRequestSchema.safeParse({ ...valid, days })
    expect(result.success).toBe(false)
  })

  it.each(['not-a-date', '2026/05/01', '05-01-2026', ''])(
    'rejects invalid startDate: %s',
    (startDate) => {
      const result = SubmitRequestSchema.safeParse({ ...valid, startDate })
      expect(result.success).toBe(false)
    },
  )

  it('rejects missing fields', () => {
    const result = SubmitRequestSchema.safeParse({ employeeId: 'emp-1' })
    expect(result.success).toBe(false)
  })
})

describe('ApproveRequestSchema', () => {
  it('accepts approve and deny', () => {
    expect(
      ApproveRequestSchema.safeParse({
        requestId: 'req-1',
        decision: 'approve',
        managerId: 'mgr-1',
      }).success,
    ).toBe(true)
    expect(
      ApproveRequestSchema.safeParse({
        requestId: 'req-1',
        decision: 'deny',
        managerId: 'mgr-1',
      }).success,
    ).toBe(true)
  })

  it('rejects an unknown decision', () => {
    const result = ApproveRequestSchema.safeParse({
      requestId: 'req-1',
      decision: 'maybe',
      managerId: 'mgr-1',
    })
    expect(result.success).toBe(false)
  })
})

describe('TimeOffRequestSchema', () => {
  const valid = {
    id: 'req-uuid',
    employeeId: 'emp-1',
    locationId: 'loc-1',
    days: 2,
    startDate: '2026-05-01',
    endDate: '2026-05-02',
    status: 'pending',
    createdAt: '2026-04-28T12:00:00.000Z',
  }

  it('accepts a pending record without decided fields', () => {
    expect(TimeOffRequestSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts an approved record with decidedBy/decidedAt', () => {
    const approved = {
      ...valid,
      status: 'approved',
      decidedAt: '2026-04-29T09:00:00.000Z',
      decidedBy: 'mgr-1',
    }
    expect(TimeOffRequestSchema.safeParse(approved).success).toBe(true)
  })

  it('rejects an unknown status', () => {
    expect(
      TimeOffRequestSchema.safeParse({ ...valid, status: 'somewhere' }).success,
    ).toBe(false)
  })
})

describe('BalanceCellSchema', () => {
  const valid = {
    employeeId: 'emp-1',
    locationId: 'loc-1',
    daysAvailable: 10,
    lastUpdated: '2026-04-28T00:00:00.000Z',
  }

  it('parses wire shape and transforms lastUpdated to a Date', () => {
    const result = BalanceCellSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.lastUpdated).toBeInstanceOf(Date)
    }
  })

  it('rejects negative balance', () => {
    expect(BalanceCellSchema.safeParse({ ...valid, daysAvailable: -1 }).success).toBe(false)
  })

  it('rejects invalid lastUpdated string', () => {
    expect(BalanceCellSchema.safeParse({ ...valid, lastUpdated: 'yesterday' }).success).toBe(
      false,
    )
  })
})

describe('BalancesResponseSchema', () => {
  it('accepts an array of cells', () => {
    const result = BalancesResponseSchema.safeParse([
      {
        employeeId: 'emp-1',
        locationId: 'loc-1',
        daysAvailable: 5,
        lastUpdated: '2026-04-28T00:00:00.000Z',
      },
    ])
    expect(result.success).toBe(true)
  })
})

describe('EmployeeSchema and LocationSchema', () => {
  it('accepts a valid employee with hireDate string', () => {
    const result = EmployeeSchema.safeParse({
      id: 'emp-1',
      name: 'Ana',
      hireDate: '2023-04-30T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.hireDate).toBeInstanceOf(Date)
  })

  it('rejects an employee with a missing name', () => {
    expect(
      EmployeeSchema.safeParse({ id: 'emp-1', name: '', hireDate: '2023-04-30T00:00:00.000Z' })
        .success,
    ).toBe(false)
  })

  it('accepts a valid location', () => {
    expect(LocationSchema.safeParse({ id: 'loc-1', name: 'HQ' }).success).toBe(true)
  })

  it('rejects a location without a name', () => {
    expect(LocationSchema.safeParse({ id: 'loc-1', name: '' }).success).toBe(false)
  })
})

describe('RequestStatusSchema', () => {
  it('accepts pending/approved/denied', () => {
    expect(RequestStatusSchema.safeParse('pending').success).toBe(true)
    expect(RequestStatusSchema.safeParse('approved').success).toBe(true)
    expect(RequestStatusSchema.safeParse('denied').success).toBe(true)
  })

  it('rejects unknown status', () => {
    expect(RequestStatusSchema.safeParse('something').success).toBe(false)
  })
})

describe('HcmErrorSchema', () => {
  it('accepts an INSUFFICIENT_BALANCE shape', () => {
    const result = HcmErrorSchema.safeParse({
      error: 'INSUFFICIENT_BALANCE',
      requested: 5,
      available: 3,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a NOT_FOUND shape', () => {
    expect(HcmErrorSchema.safeParse({ error: 'NOT_FOUND' }).success).toBe(true)
  })

  it('rejects an unknown error code', () => {
    expect(
      HcmErrorSchema.safeParse({ error: 'TEAPOT', message: 'short and stout' }).success,
    ).toBe(false)
  })

  it('rejects an INSUFFICIENT_BALANCE missing the available field', () => {
    expect(
      HcmErrorSchema.safeParse({ error: 'INSUFFICIENT_BALANCE', requested: 5 }).success,
    ).toBe(false)
  })
})
