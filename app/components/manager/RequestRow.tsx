'use client'

import { useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useBalance } from '@/lib/query/balances'
import { useApproveRequest } from '@/lib/query/requests'
import type { TimeOffRequest } from '@/lib/domain'

import { ApprovalActions } from './ApprovalActions'
import { BalanceContext, type BalanceContextState } from './BalanceContext'

export type RequestRowProps = {
  request: TimeOffRequest
  managerId: string
  defaultExpanded?: boolean
  // Test-only override: when supplied, RequestRow renders this BalanceContext
  // state instead of driving it from `useBalance`. Used by stories to render
  // tricky states (`fresh-after-stale`, `error+retry`) without setting up a
  // full MSW + cache scenario.
  forceBalanceContextState?: BalanceContextState
  // Test-only callback hooks so stories can assert handler invocations
  // without needing a QueryClient with mutation handlers.
  onApprove?: () => void
  onDeny?: () => void
}

export function RequestRow({
  request,
  managerId,
  defaultExpanded = false,
  forceBalanceContextState,
  onApprove,
  onDeny,
}: RequestRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  // Force a fresh read when expanded — TRD §4.4 pessimistic strategy.
  // `enabled` keeps the network call from firing when collapsed or when a
  // story is overriding the BalanceContext state.
  const balanceQueryEnabled = expanded && !forceBalanceContextState
  const balance = useBalance(request.employeeId, request.locationId, {
    freshOnly: true,
    enabled: balanceQueryEnabled,
  })
  const approve = useApproveRequest()

  function deriveBalanceContextState(): BalanceContextState {
    if (forceBalanceContextState) return forceBalanceContextState
    if (balance.isPending) return { kind: 'loading' }
    if (balance.isError) {
      return { kind: 'error', message: balance.error.message }
    }
    if (balance.data) return { kind: 'fresh', balance: balance.data }
    return { kind: 'loading' }
  }

  function handleApprove() {
    onApprove?.()
    approve.mutate({ requestId: request.id, decision: 'approve', managerId })
  }
  function handleDeny() {
    onDeny?.()
    approve.mutate({ requestId: request.id, decision: 'deny', managerId })
  }

  const freshReadInProgress = balanceQueryEnabled && balance.isPending
  const freshReadFailed = balanceQueryEnabled && balance.isError
  const approvalDisabled = freshReadInProgress || freshReadFailed
  const busy = approve.isPending
    ? approve.variables?.decision === 'approve'
      ? 'approve'
      : 'deny'
    : null

  return (
    <Card data-testid={`request-row-${request.id}`} data-expanded={expanded}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">
            {request.employeeId} · {request.startDate} → {request.endDate}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {request.days} day{request.days === 1 ? '' : 's'} at {request.locationId}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded((e) => !e)}
          data-testid={`expand-toggle-${request.id}`}
        >
          {expanded ? 'Collapse' : 'Review'}
        </Button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3 pt-0">
          <BalanceContext
            state={deriveBalanceContextState()}
            onRetry={() => balance.refetch()}
          />
          <ApprovalActions
            onApprove={handleApprove}
            onDeny={handleDeny}
            disabled={approvalDisabled}
            busy={busy}
          />
          {approve.isError && (
            <p className="text-xs text-destructive" data-testid="approval-error">
              Approval failed: {approve.error.error}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )
}
