import { devAssertResponse } from '@/lib/hcm/handlers'
import { findEmployee, jitter, listBalancesForEmployee } from '@/lib/hcm/state'
import { BalancesResponseSchema } from '@/lib/validation'

export async function GET(request: Request): Promise<Response> {
  await jitter(100, 800)

  const url = new URL(request.url)
  const employeeId = url.searchParams.get('employeeId')

  if (!employeeId) {
    return Response.json(
      { error: 'BAD_REQUEST', message: 'employeeId is required' },
      { status: 400 },
    )
  }

  if (!findEmployee(employeeId)) {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const cells = listBalancesForEmployee(employeeId)
  devAssertResponse(BalancesResponseSchema, cells, 'GET /api/hcm/balances')
  return Response.json(cells)
}
