export type { BalanceCell } from '@/lib/validation/balance'

// UI-only freshness signal. Does not cross the wire — derived from lastUpdated
// + the polling interval in the data layer (M3) and consumed by components.
export type BalanceFreshness = 'fresh' | 'stale' | 'unknown'
