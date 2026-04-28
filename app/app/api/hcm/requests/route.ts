import { devAssertResponse } from '@/lib/hcm/handlers'
import { jitter, listRequests } from '@/lib/hcm/state'
import { TimeOffRequestListSchema } from '@/lib/validation'

const ALLOWED_STATUSES = ['pending', 'approved', 'denied'] as const

export async function GET(request: Request): Promise<Response> {
  await jitter(100, 800)

  const url = new URL(request.url)
  const statusParam = url.searchParams.get('status')
  const employeeIdParam = url.searchParams.get('employeeId') ?? undefined

  if (statusParam !== null && !ALLOWED_STATUSES.includes(statusParam as never)) {
    return Response.json(
      { error: 'BAD_REQUEST', message: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` },
      { status: 400 },
    )
  }

  const records = listRequests({
    employeeId: employeeIdParam,
    status: (statusParam ?? undefined) as (typeof ALLOWED_STATUSES)[number] | undefined,
  })

  devAssertResponse(TimeOffRequestListSchema, records, 'GET /api/hcm/requests')
  return Response.json(records)
}
