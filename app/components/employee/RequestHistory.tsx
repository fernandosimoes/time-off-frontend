import type { TimeOffRequest } from '@/lib/domain'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Props-driven so stories can render arbitrary lifecycles without a
// QueryClient wrapper. The page calls `useRequestHistory(employeeId)` and
// passes the array down.
export type RequestHistoryProps = {
  requests: TimeOffRequest[]
}

function statusVariant(status: TimeOffRequest['status']): string {
  switch (status) {
    case 'pending':
      return 'border-primary/40 text-primary'
    case 'approved':
      return 'border-green-500/40 text-green-700 dark:text-green-400'
    case 'denied':
      return 'border-destructive/40 text-destructive'
  }
}

function statusLabel(status: TimeOffRequest['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending review'
    case 'approved':
      return 'Approved'
    case 'denied':
      return 'Denied'
  }
}

export function RequestHistory({ requests }: RequestHistoryProps) {
  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No requests yet. Submit one above to see it here.
        </CardContent>
      </Card>
    )
  }

  return (
    <ul className="space-y-2" data-testid="request-history">
      {requests.map((req) => (
        <li key={req.id}>
          <Card className={cn('border', statusVariant(req.status))}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">
                {req.startDate} → {req.endDate}
              </CardTitle>
              <span className="text-xs uppercase tracking-wide">
                {statusLabel(req.status)}
              </span>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {req.days} day{req.days === 1 ? '' : 's'} at location {req.locationId}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
