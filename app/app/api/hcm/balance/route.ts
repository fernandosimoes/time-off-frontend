import { devAssertResponse } from '@/lib/hcm/handlers'
import { findEmployee, findLocation, getBalance, jitter } from '@/lib/hcm/state'
import { BalanceCellSchema } from '@/lib/validation'

export async function GET(request: Request): Promise<Response> {
  await jitter(100, 800)

  const url = new URL(request.url)
  const employeeId = url.searchParams.get('employeeId')
  const locationId = url.searchParams.get('locationId')

  if (!employeeId || !locationId) {
    return Response.json(
      { error: 'BAD_REQUEST', message: 'employeeId and locationId are required' },
      { status: 400 },
    )
  }

  if (!findEmployee(employeeId) || !findLocation(locationId)) {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const cell = getBalance(employeeId, locationId)
  if (!cell) {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  devAssertResponse(BalanceCellSchema, cell, 'GET /api/hcm/balance')
  return Response.json(cell)
}
