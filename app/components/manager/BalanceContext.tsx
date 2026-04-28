import type { BalanceCell } from '@/lib/domain'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Pure-prop discriminated union per the manager-view design rationale: the
// page wires the hook into one of these kinds; stories drive the visuals
// directly. The `fresh-after-stale` kind is the visual answer to TRD §6
// "Approval modal with refreshed balance after stale value".
export type BalanceContextState =
  | { kind: 'loading' }
  | { kind: 'fresh'; balance: BalanceCell }
  | { kind: 'fresh-after-stale'; balance: BalanceCell; previousDays: number }
  | { kind: 'error'; message: string }

export type BalanceContextProps = {
  state: BalanceContextState
  onRetry?: () => void
}

export function BalanceContext({ state, onRetry }: BalanceContextProps) {
  switch (state.kind) {
    case 'loading':
      return (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          aria-busy="true"
          data-testid="balance-context-loading"
        >
          <span className="bg-muted inline-block h-3 w-16 animate-pulse rounded" />
          <span>Refreshing balance…</span>
        </div>
      )

    case 'fresh':
      return (
        <p className="text-sm" data-testid="balance-context-fresh">
          Balance at decision time:{' '}
          <span className="font-medium tabular-nums">{state.balance.daysAvailable}</span> days
          available
        </p>
      )

    case 'fresh-after-stale': {
      const delta = state.balance.daysAvailable - state.previousDays
      return (
        <p
          className="text-sm"
          data-testid="balance-context-fresh-after-stale"
          title={`Cached value was ${state.previousDays}; fresh read returned ${state.balance.daysAvailable}`}
        >
          Balance at decision time:{' '}
          <span className="font-medium tabular-nums">{state.balance.daysAvailable}</span> days
          available
          <span
            className={cn(
              'ml-2 inline-block rounded px-1.5 py-0.5 text-xs',
              delta > 0
                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
            )}
          >
            {delta > 0 ? '+' : ''}
            {delta} since cache
          </span>
        </p>
      )
    }

    case 'error':
      return (
        <div
          className="flex items-center gap-3 text-sm text-destructive"
          data-testid="balance-context-error"
        >
          <span>Could not read fresh balance: {state.message}</span>
          {onRetry && (
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      )
  }
}
