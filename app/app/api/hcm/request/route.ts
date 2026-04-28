import { devAssertResponse, parseBody } from '@/lib/hcm/handlers'
import {
  createRequest,
  decrementBalance,
  findEmployee,
  findLocation,
  jitter,
  shouldFailSilently,
} from '@/lib/hcm/state'
import { SubmitRequestSchema, TimeOffRequestSchema } from '@/lib/validation'

export async function POST(request: Request): Promise<Response> {
  await jitter(200, 1500)

  const parsed = await parseBody(request, SubmitRequestSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  if (!findEmployee(body.employeeId) || !findLocation(body.locationId)) {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  // Silent-failure injection: pretend success without mutating state.
  if (shouldFailSilently(request)) {
    const fake = {
      id: 'silently-failed-no-persistence',
      employeeId: body.employeeId,
      locationId: body.locationId,
      days: body.days,
      startDate: body.startDate,
      endDate: body.endDate,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    }
    devAssertResponse(TimeOffRequestSchema, fake, 'POST /api/hcm/request (silent)')
    return Response.json(fake)
  }

  const result = decrementBalance(body.employeeId, body.locationId, body.days)
  if (!result.ok && result.reason === 'NOT_FOUND') {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  }
  if (!result.ok && result.reason === 'INSUFFICIENT_BALANCE') {
    return Response.json(
      {
        error: 'INSUFFICIENT_BALANCE',
        requested: body.days,
        available: result.available,
      },
      { status: 409 },
    )
  }

  const record = createRequest(body)
  devAssertResponse(TimeOffRequestSchema, record, 'POST /api/hcm/request')
  return Response.json(record)
}
