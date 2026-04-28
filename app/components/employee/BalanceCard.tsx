import type { BalanceCell } from '@/lib/domain'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Pure-prop discriminated union per spec. The page wires hook results into
// this; stories drive it directly. No branching logic inside the component
// beyond the switch — same component, two callers, identical behavior.
export type BalanceCardState =
  | { kind: 'loading' }
  | { kind: 'empty'; locationName: string }
  | { kind: 'fresh'; balance: BalanceCell; locationName: string }
  | { kind: 'stale'; balance: BalanceCell; locationName: string }
  | {
      kind: 'optimistic-pending'
      balance: BalanceCell
      locationName: string
      pendingDelta: number
    }
  | {
      kind: 'rolled-back'
      balance: BalanceCell
      locationName: string
      reason: string
    }
  | { kind: 'error'; locationName: string; message: string }

function DaysLabel({ days }: { days: number }) {
  return (
    <p className="text-3xl font-semibold tabular-nums">
      {days}
      <span className="ml-1 text-sm font-normal text-muted-foreground">days</span>
    </p>
  )
}

export function BalanceCard({ state }: { state: BalanceCardState }) {
  switch (state.kind) {
    case 'loading':
      return (
        <Card aria-busy="true" data-testid="balance-card-loading">
          <CardHeader>
            <CardTitle className="bg-muted h-5 w-24 animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="bg-muted h-10 w-20 animate-pulse rounded" />
          </CardContent>
        </Card>
      )

    case 'empty':
      return (
        <Card data-testid="balance-card-empty">
          <CardHeader>
            <CardTitle>{state.locationName}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No balance data</p>
          </CardContent>
        </Card>
      )

    case 'fresh':
      return (
        <Card data-testid="balance-card-fresh">
          <CardHeader>
            <CardTitle>{state.locationName}</CardTitle>
          </CardHeader>
          <CardContent>
            <DaysLabel days={state.balance.daysAvailable} />
          </CardContent>
        </Card>
      )

    case 'stale':
      // Subtle visual cue (opacity), no timestamp label per TRD §6 wording.
      return (
        <Card
          className={cn('opacity-70 ring-1 ring-border')}
          data-testid="balance-card-stale"
          title="Showing cached value while we refresh"
        >
          <CardHeader>
            <CardTitle>{state.locationName}</CardTitle>
          </CardHeader>
          <CardContent>
            <DaysLabel days={state.balance.daysAvailable} />
            <p className="mt-1 text-xs text-muted-foreground">Refreshing…</p>
          </CardContent>
        </Card>
      )

    case 'optimistic-pending':
      return (
        <Card
          className="border-primary/40"
          aria-busy="true"
          data-testid="balance-card-pending"
        >
          <CardHeader>
            <CardTitle>{state.locationName}</CardTitle>
          </CardHeader>
          <CardContent>
            <DaysLabel days={state.balance.daysAvailable} />
            <p className="mt-1 text-xs text-primary">
              Submitting {state.pendingDelta} day{state.pendingDelta === 1 ? '' : 's'}…
            </p>
          </CardContent>
        </Card>
      )

    case 'rolled-back':
      return (
        <Card
          className="border-destructive/40"
          data-testid="balance-card-rolled-back"
        >
          <CardHeader>
            <CardTitle>{state.locationName}</CardTitle>
          </CardHeader>
          <CardContent>
            <DaysLabel days={state.balance.daysAvailable} />
            <p className="mt-1 text-xs text-destructive">
              Last submission rolled back: {state.reason}
            </p>
          </CardContent>
        </Card>
      )

    case 'error':
      return (
        <Card className="border-destructive/40" data-testid="balance-card-error">
          <CardHeader>
            <CardTitle>{state.locationName}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{state.message}</p>
          </CardContent>
        </Card>
      )
  }
}
