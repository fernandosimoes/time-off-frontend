import { BalanceCard, type BalanceCardState } from './BalanceCard'

// Pure-prop component. The page-level composer derives `entries` from
// `useBalances()` + the locations list; stories supply states directly.
export type BalanceListEntry = {
  key: string
  state: BalanceCardState
}

export function BalanceList({ entries }: { entries: BalanceListEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No locations to display.</p>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map((entry) => (
        <BalanceCard key={entry.key} state={entry.state} />
      ))}
    </div>
  )
}
