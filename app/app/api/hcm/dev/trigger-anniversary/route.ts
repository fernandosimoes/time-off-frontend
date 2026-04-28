import { z } from 'zod'

import { devAssertResponse, parseBody } from '@/lib/hcm/handlers'
import { applyAnniversaryFor, findEmployee } from '@/lib/hcm/state'
import { BalancesResponseSchema } from '@/lib/validation'

const TriggerAnniversarySchema = z.object({
  employeeId: z.string().min(1),
})

export async function POST(request: Request): Promise<Response> {
  const parsed = await parseBody(request, TriggerAnniversarySchema)
  if (!parsed.ok) return parsed.response

  if (!findEmployee(parsed.data.employeeId)) {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const updated = applyAnniversaryFor(parsed.data.employeeId)
  devAssertResponse(BalancesResponseSchema, updated, 'POST /api/hcm/dev/trigger-anniversary')
  return Response.json(updated)
}
