import { seedPendingRequests } from '@/lib/hcm/state'

export async function POST(): Promise<Response> {
  const created = seedPendingRequests()
  return Response.json(created)
}
