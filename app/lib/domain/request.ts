export type { RequestStatus, TimeOffRequest } from '@/lib/validation/request'

// UI request lifecycle as a discriminated union (TRD §4.10). This is a UI-only
// shape: it tracks optimistic state that never crosses the wire. Wire-side
// status comes from the persisted TimeOffRequest record.
export type RequestState =
  | { status: 'draft' }
  | { status: 'optimistic-pending'; submittedAt: Date }
  | { status: 'submitted'; serverId: string }
  | { status: 'rolling-back'; reason: string }
  | { status: 'rejected'; reason: string }
  | { status: 'approved'; approvedBy: string; approvedAt: Date }
  | { status: 'denied'; deniedBy: string; reason: string }

// Terminal states are those a request cannot leave: a manager decision
// (approved/denied) or an HCM-side rejection of an optimistic submission.
export function isTerminal(state: RequestState): boolean {
  return (
    state.status === 'approved' || state.status === 'denied' || state.status === 'rejected'
  )
}
