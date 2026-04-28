import { resetState } from '@/lib/hcm/state'

export async function POST(): Promise<Response> {
  resetState()
  return Response.json({ ok: true })
}
