import { devAssertResponse, parseBody } from '@/lib/hcm/handlers'
import { decideRequest, getRequest, jitter, shouldFailSilently } from '@/lib/hcm/state'
import { ApproveRequestSchema, TimeOffRequestSchema } from '@/lib/validation'

export async function POST(request: Request): Promise<Response> {
  await jitter(200, 1500)

  const parsed = await parseBody(request, ApproveRequestSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const existing = getRequest(body.requestId)
  if (!existing) {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  if (shouldFailSilently(request)) {
    const fake = {
      ...existing,
      status: body.decision === 'approve' ? ('approved' as const) : ('denied' as const),
      decidedAt: new Date().toISOString(),
      decidedBy: body.managerId,
    }
    devAssertResponse(TimeOffRequestSchema, fake, 'POST /api/hcm/approve (silent)')
    return Response.json(fake)
  }

  const updated = decideRequest(body.requestId, body.decision, body.managerId)
  if (!updated) {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  }
  devAssertResponse(TimeOffRequestSchema, updated, 'POST /api/hcm/approve')
  return Response.json(updated)
}
