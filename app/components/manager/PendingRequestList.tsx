import type { TimeOffRequest } from '@/lib/domain'
import { Card, CardContent } from '@/components/ui/card'

import { RequestRow } from './RequestRow'

export type PendingRequestListProps = {
  requests: TimeOffRequest[]
  managerId: string
}

export function PendingRequestList({ requests, managerId }: PendingRequestListProps) {
  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No pending requests. Triggers a re-poll every 60 seconds; check back soon.
        </CardContent>
      </Card>
    )
  }

  return (
    <ul className="space-y-3" data-testid="pending-request-list">
      {requests.map((req) => (
        <li key={req.id}>
          <RequestRow request={req} managerId={managerId} />
        </li>
      ))}
    </ul>
  )
}
